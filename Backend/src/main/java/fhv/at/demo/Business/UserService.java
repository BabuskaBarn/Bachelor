package fhv.at.demo.Business;
import fhv.at.demo.Entity.AppUser;
import fhv.at.demo.Repository.AppUserRepository;
import org.springframework.stereotype.Service;
import fhv.at.demo.Dtos.UserDto;
import fhv.at.demo.Entity.AppUser;
import fhv.at.demo.Repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;


@Service
@RequiredArgsConstructor
public class UserService {


    private final AppUserRepository repository;

    private final PasswordEncoder passwordEncoder;

@Transactional
public ResponseEntity<Map<String, Object>> register(UserDto userDto){

    Map<String, Object> response = new HashMap<>();

    if(repository.existsByUsername(userDto.getUsername())){
        response.put("succes", false);
        response.put("message", "Username already exists");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    AppUser user =new AppUser(userDto.getUsername(), passwordEncoder.encode(userDto.getPassword()));
    AppUser appuser= repository.save(user);

    return ResponseEntity.ok(response);
}

@Transactional
public ResponseEntity<Map<String, Object>> login(UserDto userDto){
    Map<String, Object> response = new HashMap<>();

    AppUser user = repository.findByUsername(userDto.getUsername()).orElse(null);

    if(user==null || passwordEncoder.matches(userDto.getPassword(), user.getPassword())) {
        response.put("success", false);
        response.put("message", "Invalid credentials");
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    response.put("success", true);
    response.put("userId", user.getId());
    response.put("username", user.getUsername());
    response.put("message", "Login successful");

    return ResponseEntity.ok(response);

}


    @Transactional(readOnly = true)
    public AppUser getUserById(UUID id) {
        return repository.findById(id).orElse(null);
    }
}
