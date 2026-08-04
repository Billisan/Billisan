package dev.billisan.inspection.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record InspectionResultRequest(
        UUID returnAttemptId,
        UUID inspectionRequestId,
        ProcessStatus processStatus,
        Result result,
        BigDecimal confidence,
        String modelVersion,
        String errorCode,
        InferenceNode inferenceNode) {

    public enum ProcessStatus {
        COMPLETED, FAILED
    }

    public enum Result {
        NORMAL, DAMAGED, UNCERTAIN, FAILED
    }

    public enum InferenceNode {
        JETSON_ORIN
    }
}
