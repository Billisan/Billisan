package dev.billisan.slot;

public class SlotUnavailableException extends RuntimeException {

	private final String stationId;
	private final SlotAllocationService.WorkType workType;

	public SlotUnavailableException(
		String stationId,
		SlotAllocationService.WorkType workType
	) {
		super("No eligible slot is currently available");
		this.stationId = stationId;
		this.workType = workType;
	}

	public String getStationId() {
		return stationId;
	}

	public SlotAllocationService.WorkType getWorkType() {
		return workType;
	}
}
