package fhv.at.demo.Controller;


import fhv.at.demo.Business.TrainingSessionService;
import fhv.at.demo.Dtos.SessionRequestDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/sessions")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class SessionController {
    private final TrainingSessionService service;


    @PostMapping
    public ResponseEntity<Map<String, Object>> saveSession(@RequestBody SessionRequestDto request) {
        return service.saveSession(request);
    }

    // Alle Sessions eines Users (für History)
    @GetMapping("/user/{userId}")
    public ResponseEntity<Map<String, Object>> getUserSessions(@PathVariable UUID userId) {
        return service.getUserSessions(userId);
    }

    // Eine bestimmte Session
    @GetMapping("/{sessionId}")
    public ResponseEntity<Map<String, Object>> getSessionById(@PathVariable Long sessionId) {
        return service.getSessionById(sessionId);
    }


    @GetMapping("/user/{userId}/feedback")
    public ResponseEntity<Map<String, Object>> feedback(@PathVariable UUID userId) {
        return service.feedback(userId);
    }





}