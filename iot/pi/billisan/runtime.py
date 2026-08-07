"""프로세스 전역 공유 상태. 여러 계층이 함께 읽고 쓰는 값만 여기 모은다."""
import threading

from .utils import _iso_ts

# 런타임에 주입되는 클라이언트 핸들 (main에서 채운다)
_runtime = {"orin_client": None, "edge_client": None}

# commandId -> 처리 결과 (스프링 명령 재실행 방지, 문서 MQTT-AC-004)
processed_spring_commands = {}

# 동시 물리 플로우 방지 - 카메라 1대/서보 1대라 인증·대여·반납은 한 번에 하나만.
_flow_lock = threading.Lock()

# 스프링이 EDGE-DEVICE-001 응답으로 내려주는 권위 재고의 최신 캐시.
# 12-I 원칙상 Pi는 업무 수치를 임의 생성하지 않으므로, 스프링이 준 값만 보관·중계한다.
# (스프링이 아직 필드를 안 내려주면 None 유지 -> 기존 로컬 센서 폴백)
_inventory_cache = {"inventory": None, "observedAt": None}
_inventory_lock = threading.Lock()


def _update_inventory_cache(inventory):
    """EDGE-DEVICE-001 응답의 inventory를 캐시에 저장. 형식 불충분하면 무시."""
    if not isinstance(inventory, dict):
        return None
    if "rentableSlotCount" not in inventory:
        return None
    with _inventory_lock:
        _inventory_cache["inventory"] = {
            "rentableSlotCount": inventory.get("rentableSlotCount"),
            "emptyReturnSlotCount": inventory.get("emptyReturnSlotCount"),
            "totalSlotCount": inventory.get("totalSlotCount"),
        }
        _inventory_cache["observedAt"] = _iso_ts()
        return dict(_inventory_cache["inventory"])


def _get_inventory_cache():
    with _inventory_lock:
        if _inventory_cache["inventory"] is None:
            return None, None
        return dict(_inventory_cache["inventory"]), _inventory_cache["observedAt"]


# 동시 물리 플로우 방지 - 카메라 1대/서보 1대라 인증/대여/반납은 한 번에 하나만.
