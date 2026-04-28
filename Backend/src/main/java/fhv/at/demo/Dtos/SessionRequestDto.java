package fhv.at.demo.Dtos;

import lombok.Data;
import java.util.UUID;

@Data
public class SessionRequestDto {
    private UUID userId;
    private SessionDto sessionData;
}