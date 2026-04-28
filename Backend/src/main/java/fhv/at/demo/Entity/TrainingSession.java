package fhv.at.demo.Entity;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name="Training:sessions")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TrainingSession {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @Column(name= "session_data", columnDefinition = "TEXT")
    private String sessionData;

    @Column(name = "left_reps")
    private Integer leftReps;

    @Column(name = "right_reps")
    private Integer rightReps;

    @Column(name = "total_reps")
    private Integer totalReps;

    @Column(name = "duration")
    private Double duration;

    @Column(name = "created_at")
    private LocalDateTime createdAt;


    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public TrainingSession(AppUser user, String sessionData, Integer leftReps, Integer rightReps, Integer totalReps, Double duration) {
        this.user = user;
        this.sessionData = sessionData;
        this.leftReps = leftReps;
        this.rightReps = rightReps;
        this.totalReps = totalReps;
        this.duration = duration;
        this.createdAt = LocalDateTime.now();
    }
}
