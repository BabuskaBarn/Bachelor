package fhv.at.demo.Dtos;

import lombok.Data;

@Data
public class UserDto {
    private String username;
    private String password;

    public UserDto() {}

    public UserDto(String username, String password) {
        this.username = username;
        this.password = password;
    }
}