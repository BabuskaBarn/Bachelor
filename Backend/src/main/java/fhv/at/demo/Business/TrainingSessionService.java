package fhv.at.demo.Business;

import fhv.at.demo.Dtos.SessionDto;
import fhv.at.demo.Dtos.SessionRequestDto;
import fhv.at.demo.Entity.AppUser;
import fhv.at.demo.Entity.TrainingSession;
import fhv.at.demo.Repository.AppUserRepository;
import fhv.at.demo.Repository.TrainingSessionRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TrainingSessionService {

    private final TrainingSessionRepository sessionRepository;
    private final AppUserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Transactional
    public ResponseEntity<Map<String, Object>> saveSession(SessionRequestDto request) {
        Map<String, Object> response = new HashMap<>();

        try {
            // 1. User finden
            AppUser user = userRepository.findById(request.getUserId()).orElse(null);

            if (user == null) {
                response.put("success", false);
                response.put("message", "User not found");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
            }

            // 2. SessionDto aus Request holen
            SessionDto sessionData = request.getSessionData();

            // 3. Komplettes SessionDto als JSON speichern
            String sessionDataJson = objectMapper.writeValueAsString(sessionData);

            // 4. TrainingSession erstellen und alle Felder setzen
            TrainingSession session = new TrainingSession();
            session.setUser(user);                                    // ← Setzt den User
            session.setSessionData(sessionDataJson);                  // ← Setzt das komplette JSON
            session.setLeftReps(sessionData.getLeftReps());           // ← Setzt leftReps
            session.setRightReps(sessionData.getRightReps());         // ← Setzt rightReps
            session.setTotalReps(sessionData.getTotalReps());         // ← Setzt totalReps
            session.setDuration(sessionData.getDuration());           // ← Setzt duration
            // createdAt wird automatisch durch @PrePersist gesetzt

            // 5. Speichern
            TrainingSession savedSession = sessionRepository.save(session);

            // 6. Response
            response.put("success", true);
            response.put("message", "Training session saved successfully");
            response.put("sessionId", savedSession.getId());
            response.put("session", Map.of(
                    "id", savedSession.getId(),
                    "leftReps", savedSession.getLeftReps(),
                    "rightReps", savedSession.getRightReps(),
                    "totalReps", savedSession.getTotalReps(),
                    "duration", savedSession.getDuration(),
                    "createdAt", savedSession.getCreatedAt()
            ));
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            e.printStackTrace();
            response.put("success", false);
            response.put("message", "Failed to save training session: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getUserSessions(UUID userId) {
        Map<String, Object> response = new HashMap<>();

        try {
            List<TrainingSession> sessions = sessionRepository.findByUserIdOrderByCreatedAtDesc(userId);

            List<Map<String, Object>> sessionList = sessions.stream().map(session -> {
                Map<String, Object> sessionMap = new HashMap<>();
                sessionMap.put("id", session.getId());
                sessionMap.put("leftReps", session.getLeftReps());
                sessionMap.put("rightReps", session.getRightReps());
                sessionMap.put("totalReps", session.getTotalReps());
                sessionMap.put("duration", session.getDuration());
                sessionMap.put("createdAt", session.getCreatedAt());

                // SessionData JSON parsen - das enthält errors und repRecords!
                try {
                    SessionDto sessionData = objectMapper.readValue(session.getSessionData(), SessionDto.class);
                    sessionMap.put("sessionData", sessionData);
                    sessionMap.put("errors", sessionData.getErrors());      // ← Deine Errors
                    sessionMap.put("repRecords", sessionData.getRepRecords()); // ← Deine RepRecords
                } catch (Exception e) {
                    sessionMap.put("sessionData", null);
                    sessionMap.put("errors", null);
                    sessionMap.put("repRecords", null);
                }

                return sessionMap;
            }).collect(Collectors.toList());

            response.put("success", true);
            response.put("sessions", sessionList);
            response.put("count", sessionList.size());
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            e.printStackTrace();
            response.put("success", false);
            response.put("message", "Failed to retrieve sessions: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }

    @Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getSessionById(Long sessionId) {
        Map<String, Object> response = new HashMap<>();

        try {
            TrainingSession session = sessionRepository.findById(sessionId).orElse(null);

            if (session == null) {
                response.put("success", false);
                response.put("message", "Session not found");
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
            }

            // SessionData JSON parsen
            SessionDto sessionData = objectMapper.readValue(session.getSessionData(), SessionDto.class);

            Map<String, Object> sessionMap = new HashMap<>();
            sessionMap.put("id", session.getId());
            sessionMap.put("leftReps", session.getLeftReps());
            sessionMap.put("rightReps", session.getRightReps());
            sessionMap.put("totalReps", session.getTotalReps());
            sessionMap.put("duration", session.getDuration());
            sessionMap.put("createdAt", session.getCreatedAt());
            sessionMap.put("userId", session.getUser().getId());
            sessionMap.put("username", session.getUser().getUsername());
            sessionMap.put("sessionData", sessionData);
            sessionMap.put("errors", sessionData.getErrors());      // ← Deine Errors
            sessionMap.put("repRecords", sessionData.getRepRecords()); // ← Deine RepRecords

            response.put("success", true);
            response.put("session", sessionMap);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            e.printStackTrace();
            response.put("success", false);
            response.put("message", "Failed to retrieve session: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
}