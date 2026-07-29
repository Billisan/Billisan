"""신규 우산 개체(데모용) 정상 데이터 촬영 보조 도구.

`DATA_COLLECTION.md` §5-1(허브 중앙 정렬·손/소매 프레임 이탈)·§8 체크리스트를 화면에
실시간으로 보여주며 SPACE로 저장한다.

⚠️ **CLAUDE.md 최우선 원칙은 "얼굴 원본 영구 저장 금지"이지 "우산 원본 저장 금지"가
아니다.** 2026-07-24 244장 배치 때는 이 촬영 구도(카메라 정면에서 우산을 드는 방식)의
원본 프레임 대부분에 촬영자 얼굴이 함께 찍혔고, 자동 얼굴 탐지/블러 방식이 전부 실측에서
놓침이 확인돼 "원본 자체를 저장하지 않는다"는 구조적 해법을 썼다. 하지만 그건 얼굴이
프레임에 실제로 들어왔기 때문이지 우산이라서가 아니다 — **카메라 프레임에 얼굴이 들어오지
않도록 촬영 구도를 잡으면, 원본을 그대로 백업해도 원칙과 충돌하지 않는다.**

**촬영 시작 전 반드시 라이브 화면으로 얼굴이 프레임 밖인지 육안 확인할 것.** 확인 없이
이 스크립트를 돌리면 `_raw_backup/`에 얼굴이 포함된 원본이 그대로 영구 저장될 위험이 있다.

저장물 2종:
1. **크롭본**(`<outdir>/<split>/good/normal_XXXX.jpg`) — `crop.py`의 `crop_umbrella()`
   기본 `mode=bbox`(외접, 캐노피 전체 보존) + `padding=0.05`(약한 여백)로 저장. 학습
   파이프라인이 바로 읽는 최종 구조라 `precrop_dataset.py`/`organize_dataset.py` 불필요.
2. **원본 백업**(`<outdir>/_raw_backup/<split>/raw_XXXX.jpg`) — 크롭 전 프레임 그대로.
   `.gitignore`에서 `datasets/*/_raw_backup/`을 통째로 제외해 **커밋 대상에서 원천 차단**
   (로컬 전용, 재크롭·검수용). 우산이 검출 안 된 상태로 SPACE를 누르면 둘 다 저장하지 않는다.

라이브 조작:
    SPACE   현재 프레임을 크롭+원본 백업으로 저장 (우산 미검출 시 저장 안 함)
    r       화면 카운터만 리셋(파일은 지우지 않음)
    q/ESC   종료

사용 예:
    .venv\\Scripts\\python.exe capture_umbrella.py --outdir datasets/umbrella_yellow --split train --target 30 --camera 1
    .venv\\Scripts\\python.exe capture_umbrella.py --outdir datasets/umbrella_yellow --split defective --defect_type tear --target 15 --camera 1

⚠️ **`--split defective`는 우산이 1개뿐이고 정상 데모용으로도 계속 써야 하는 경우, 반드시
가역적 손상(마스킹테이프 등 탈부착 가능한 방법)에만 쓸 것** — 실제로 절개·파손하면 그
개체는 더 이상 정상 시연에 못 쓴다(2026-07-28 팀 결정, `DATA_COLLECTION.md` §3-2·§4-1).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import cv2
from ultralytics import YOLO

sys.path.insert(0, str(Path(__file__).resolve().parent))
from crop import crop_umbrella, CROP_MODES  # noqa: E402

ROOT = Path(__file__).resolve().parent
UMBRELLA_ID = 25  # COCO
DEFAULT_CROP_MODE_THIS_SCRIPT = "bbox"  # 외접 — 캐노피 전체 보존(테두리 파손 대비). crop.py 일반 기본값(inscribed)과 다르다
DEFAULT_CROP_PADDING = 0.05  # crop.py DESCRIPTION.md 일반 권장값(약한 여백) — 얼굴 안전 마진 목적의 음수 패딩은 폐기(얼굴은 프레임 구도로 배제)

GREEN = (0, 220, 0)
RED = (60, 60, 255)
WHITE = (255, 255, 255)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="우산 정상 데이터 촬영 보조 (촬영 즉시 크롭 저장)")
    p.add_argument("--outdir", required=True, help="데이터셋 루트 (예: datasets/umbrella_yellow)")
    p.add_argument("--split", choices=["train", "test", "defective"], required=True,
                   help="이번 세션 저장 대상. defective는 항상 test/defective 아래 저장")
    p.add_argument("--defect_type", choices=["tear", "rib"], default=None,
                   help="--split defective일 때 필수. DESCRIPTION.md/DATA_COLLECTION.md §4 두 후보")
    p.add_argument("--target", type=int, default=30, help="이번 세션 목표 매수(화면 표시용, 도달해도 계속 저장 가능)")
    p.add_argument("--camera", type=int, default=0)
    p.add_argument("--width", type=int, default=1280)
    p.add_argument("--height", type=int, default=720)
    p.add_argument("--model", default=str(ROOT / "yolov8n.pt"))
    p.add_argument("--conf", type=float, default=0.25)
    p.add_argument("--crop_mode", default=DEFAULT_CROP_MODE_THIS_SCRIPT,
                    help=f"크롭 모드(기본 {DEFAULT_CROP_MODE_THIS_SCRIPT}=외접, 캐노피 전체 보존). 가능값: {CROP_MODES}")
    p.add_argument("--padding", type=float, default=DEFAULT_CROP_PADDING,
                    help="크롭 여백 비율. 촬영 구도로 얼굴이 이미 프레임 밖이라는 전제 — 얼굴 차단용 음수 패딩 아님")
    p.add_argument("--no_raw_backup", action="store_true",
                    help="원본 백업 저장을 끈다(기본은 저장). 카메라 프레임에 얼굴이 들어올 가능성이 있으면 반드시 켜서(=이 플래그 사용) 백업을 꺼야 한다")
    p.add_argument("--no-mirror", action="store_true")
    args = p.parse_args()
    if args.split == "defective" and args.defect_type is None:
        p.error("--split defective 에는 --defect_type {tear,rib} 이 필요합니다")
    return args


def open_camera(index: int, width: int, height: int) -> cv2.VideoCapture:
    backend = cv2.CAP_DSHOW if sys.platform == "win32" else cv2.CAP_V4L2
    cap = cv2.VideoCapture(index, backend)
    if not cap.isOpened():
        cap = cv2.VideoCapture(index)
    if not cap.isOpened():
        raise RuntimeError(f"카메라 {index}번을 열 수 없습니다. 다른 앱이 점유 중이거나 인덱스가 틀렸을 수 있습니다.")
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
    return cap


def best_umbrella_box(result):
    if result.boxes is None:
        return None, 0.0
    best = None
    for box in result.boxes:
        if int(box.cls.item()) != UMBRELLA_ID:
            continue
        conf = float(box.conf.item())
        if best is None or conf > best[1]:
            best = (box.xyxy[0].tolist(), conf)
    return (best[0], best[1]) if best else (None, 0.0)


def draw_guide(canvas) -> None:
    """허브(중심축)를 맞춰야 할 중앙 50% 영역 — §5-1 규율."""
    h, w = canvas.shape[:2]
    x1, y1 = int(w * 0.25), int(h * 0.25)
    x2, y2 = int(w * 0.75), int(h * 0.75)
    cv2.rectangle(canvas, (x1, y1), (x2, y2), WHITE, 1, cv2.LINE_AA)
    cv2.putText(canvas, "hub center guide", (x1, max(y1 - 8, 14)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, WHITE, 1, cv2.LINE_AA)


def main() -> None:
    args = parse_args()
    dataset_root = Path(args.outdir)
    if args.split == "train":
        save_dir = dataset_root / "train" / "good"
        name_prefix = "normal_"
        backup_subdir = "train"
    elif args.split == "test":
        save_dir = dataset_root / "test" / "good"
        name_prefix = "test_normal_"
        backup_subdir = "test"
    else:  # defective
        save_dir = dataset_root / "test" / "defective"
        name_prefix = f"anomaly_{args.defect_type}_"
        backup_subdir = f"defective_{args.defect_type}"
    save_dir.mkdir(parents=True, exist_ok=True)

    raw_backup_dir = dataset_root / "_raw_backup" / backup_subdir
    if not args.no_raw_backup:
        raw_backup_dir.mkdir(parents=True, exist_ok=True)

    existing = sorted(save_dir.glob(f"{name_prefix}*.jpg"))
    # 개수가 아니라 최대 인덱스 기준 — 중간 배치를 아카이브/삭제해 개수가 줄어도 번호가 되감기지 않는다
    existing_indices = [int(p.stem.rsplit("_", 1)[-1]) for p in existing if p.stem.rsplit("_", 1)[-1].isdigit()]
    next_idx = (max(existing_indices) + 1) if existing_indices else 1

    model = YOLO(args.model)
    cap = open_camera(args.camera, args.width, args.height)
    print(f"[out] {save_dir.resolve()} (기존 {len(existing)}장, {next_idx}번부터 이어서 저장)")
    print(f"[src] camera {args.camera} {int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))}x{int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))}")
    print(f"[crop] mode={args.crop_mode} padding={args.padding} (외접이면 캐노피 전체 보존)")
    if args.no_raw_backup:
        print("[backup] 비활성화 — 원본 프레임은 저장하지 않음")
    else:
        print(f"[backup] {raw_backup_dir.resolve()} 에 크롭 전 원본도 함께 저장")
        print("[!!] 시작 전 라이브 화면을 육안으로 확인하라 — 얼굴이 프레임 안에 보이면 즉시 q로 종료하고")
        print("     카메라 각도를 조정하거나 --no_raw_backup으로 재실행할 것. 원본 백업은 커밋 대상이 아니다(.gitignore).")
    print("SPACE=크롭+원본 저장  r=화면 카운터 리셋  q/ESC=종료")
    print("체크: 허브가 안내 사각형 안에 있는가? 손/소매가 화면에 안 걸리는가?\n")

    saved = 0
    skipped_no_detect = 0
    split_label = args.split if args.split != "defective" else f"defective:{args.defect_type}"
    window = f"umbrella capture [{split_label}] (SPACE=save, q=quit)"
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                print("[warn] 프레임을 읽지 못했습니다. 종료합니다.")
                break
            if not args.no_mirror:
                frame = cv2.flip(frame, 1)

            result = model.predict(frame, conf=args.conf, classes=[UMBRELLA_ID], verbose=False)[0]
            box, conf = best_umbrella_box(result)

            canvas = frame.copy()
            draw_guide(canvas)
            if box is not None:
                x1, y1, x2, y2 = (int(v) for v in box)
                cv2.rectangle(canvas, (x1, y1), (x2, y2), GREEN, 2)
            status_color = GREEN if conf >= args.conf else RED
            cv2.putText(canvas, f"umbrella conf={conf:.2f}", (16, 32),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, status_color, 2, cv2.LINE_AA)
            cv2.putText(canvas, f"saved {saved}/{args.target} [{args.split}]", (16, 64),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, WHITE, 2, cv2.LINE_AA)
            cv2.putText(canvas, "SPACE=save  r=reset  q=quit", (16, canvas.shape[0] - 16),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (170, 170, 170), 1, cv2.LINE_AA)

            cv2.imshow(window, canvas)
            key = cv2.waitKey(1) & 0xFF
            if key in (ord("q"), 27):
                break
            if key == ord("r"):
                saved = 0
                print("[reset] 화면 카운터만 초기화(파일은 유지)")
            if key == 32:  # SPACE
                if box is None:
                    skipped_no_detect += 1
                    print(f"  [skip] 우산 미검출 — 저장 안 함 (누적 미검출 {skipped_no_detect}건)")
                    continue
                crop = crop_umbrella(frame, box, mode=args.crop_mode, padding=args.padding)
                if crop is None or crop.size == 0:
                    skipped_no_detect += 1
                    print(f"  [skip] 크롭 실패(너무 작음) — 저장 안 함")
                    continue
                idx = next_idx + saved
                name = f"{name_prefix}{idx:04d}.jpg"
                cv2.imwrite(str(save_dir / name), crop)
                backup_note = ""
                if not args.no_raw_backup:
                    raw_name = f"raw_{idx:04d}.jpg"
                    cv2.imwrite(str(raw_backup_dir / raw_name), frame)
                    backup_note = f" (+backup {raw_name})"
                saved += 1
                print(f"  [saved {saved}/{args.target}] {name}{backup_note}")
    finally:
        cap.release()
        cv2.destroyAllWindows()

    print(f"\n이번 실행: {saved}장 저장, {skipped_no_detect}건 미검출로 스킵 -> {save_dir.resolve()}")
    print("저장된 이미지는 이미 크롭 완료 상태다 — train.py 실행 시 반드시 --crop_mode full 사용.")


if __name__ == "__main__":
    main()
