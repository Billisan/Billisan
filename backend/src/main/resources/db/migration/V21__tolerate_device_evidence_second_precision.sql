-- 장치(Pi)가 보고하는 evidence.observedAt은 초 단위까지만 온다(소수점 없음)인 반면
-- requested_at은 서버 LocalDateTime.now() 기준 마이크로초 정밀도다. 명령 발행부터 물리
-- 반응까지가 1초 미만으로 끝나면, 실제로는 나중에 관측된 값인데도 초 단위로 잘린
-- evidence_observed_at이 requested_at보다 숫자상 앞서는 경우가 실제 장치에서 재현됐다
-- (EC2 실측). 이 제약의 원래 의도(터무니없이 과거 시각이 오는 걸 걸러내는 것)는 유지하되,
-- 초 단위 정밀도 손실만큼만 여유를 준다.
ALTER TABLE `device_operation`
	DROP CHECK `CK_DEVICE_OPERATION_LIFECYCLE_TIME_ORDER`,
	ADD CONSTRAINT `CK_DEVICE_OPERATION_LIFECYCLE_TIME_ORDER`
		CHECK (
			(`acked_at` IS NULL OR `acked_at` >= `requested_at`)
			AND (
				`evidence_observed_at` IS NULL
				OR `evidence_observed_at` >= `requested_at` - INTERVAL 1 SECOND
			)
			AND (
				`completed_at` IS NULL
				OR `completed_at` >= COALESCE(`acked_at`, `requested_at`)
			)
		);
