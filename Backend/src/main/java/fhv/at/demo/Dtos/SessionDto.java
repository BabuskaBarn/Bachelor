package fhv.at.demo.Dtos;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class SessionDto {
    private Integer leftReps;
    private Integer rightReps;
    private Integer totalReps;
    private Long startTime;
    private Long endTime;
    private Double duration;
    private List<RepRecord> repRecords;
    private Map<String, List<String>> errors;

    @Data
    public static class RepRecord {
        private String arm;
        private Integer repNumber;
        private Double raiseTime;
        private Double lowerTime;
        private List<String> errors;
        private Long timestamp;
    }
}