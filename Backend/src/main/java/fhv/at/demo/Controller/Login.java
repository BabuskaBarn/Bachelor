package fhv.at.demo.Controller;

import fhv.at.demo.Business.UserService;
import fhv.at.demo.Dtos.UserDto;
import fhv.at.demo.Entity.AppUser;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;


import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
public class Login {

    private final UserService service;

    public Login(UserService service) {
        this.service = service;
    }

    @PostMapping("register")
    public ResponseEntity<Map<String, Object>> register(@RequestBody UserDto userDto){
        return service.register(userDto);
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody UserDto userDto) {

        return service.login(userDto);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getUserById(@PathVariable UUID id){
        var user= service.getUserById(id);
        if(user==null){
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(user);
    }
}