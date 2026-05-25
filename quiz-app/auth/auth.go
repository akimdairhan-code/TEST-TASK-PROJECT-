package auth

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sync"
	"time"

	"encore.app/ent"
	entuser "encore.app/ent/user"
	encoreauth "encore.dev/beta/auth"
	_ "encore.app/ent/runtime"	
	"encore.dev/storage/sqldb"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

var authDB = sqldb.NewDatabase("quiz", sqldb.DatabaseConfig{
	Migrations: "./migrations",
})

var (
	entClient *ent.Client
	once      sync.Once
)

// getClient ensures we only open the Ent client once and reuse it.
func getClient() (*ent.Client, error) {
    var err error
    once.Do(func() {
        db := authDB.Stdlib()
        entClient, err = ent.OpenEntClient(db)
    })
    
    if err != nil {
        return nil, err
    }
    return entClient, nil
}
var jwtSecret = []byte("super-secret-key-change-in-prod")

type RegisterRequest struct {
Email    string `json:"email"`
Password string `json:"password"`		
Role     string `json:"role"`
}

type LoginRequest struct {
Email    string `json:"email"`
Password string `json:"password"`
}

type AuthResponse struct {
Token string `json:"token"`
Role  string `json:"role"`
}

type UserData struct {
UserID string
Role   string
Email  string
}

//encore:api public method=POST path=/auth/register
func Register(ctx context.Context, req *RegisterRequest) (*AuthResponse, error) {
    // 1. Validation
    if req.Email == "" || req.Password == "" {
        return nil, errors.New("email и пароль обязательны")
    }

    // 2. Hash Password
    hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
    if err != nil {
        return nil, err
    }

    // 3. Get the shared Ent client
    client, err := getClient()
    if err != nil {
        return nil, fmt.Errorf("database error: %w", err)
    }


    user, err := client.User.Create().
						SetID(uuid.New()).
						SetEmail(req.Email).
						SetPasswordHash(string(hash)).
						SetRole(req.Role).
						SetCreatedAt(time.Now()).
						Save(ctx)

	if err != nil {
		// Проверяем, является ли ошибка нарушением уникальности (Constraint Error)
		if ent.IsConstraintError(err) {
			return nil, errors.New("пользователь с таким email уже зарегистрирован")
		}
		// Если ошибка другая — логируем и возвращаем как есть
		return nil, fmt.Errorf("ошибка при создании пользователя: %w", err)
	}

    token, err := createToken(user.ID.String(), req.Email, req.Role)
    if err != nil {
        return nil, err
    }

    return &AuthResponse{Token: token, Role: req.Role}, nil
}

//encore:api public method=POST path=/auth/login
func Login(ctx context.Context, req *LoginRequest) (*AuthResponse, error) {
	client, err := getClient()
	if err != nil {
		return nil, err
	}

	user, err := client.User.Query().
		Where(entuser.Email(req.Email)).
		Only(ctx)
	if err != nil {
		return nil, errors.New("неверный email или пароль")
	}

	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		return nil, errors.New("неверный email или пароль")
	}

	token, err := createToken(user.ID.String(), req.Email, user.Role)
	return &AuthResponse{Token: token, Role: user.Role}, err
}		

//encore:authhandler
func AuthHandler(ctx context.Context, token string) (encoreauth.UID, *UserData, error) {
parsed, err := jwt.Parse(token, func(t *jwt.Token) (interface{}, error) {
return jwtSecret, nil
})
if err != nil || !parsed.Valid {
return "", nil, errors.New("неверный токен")
}

claims := parsed.Claims.(jwt.MapClaims)
userID := claims["user_id"].(string)
email := claims["email"].(string)
role := claims["role"].(string)

return encoreauth.UID(userID), &UserData{
UserID: userID,
Role:   role,
Email:  email,
}, nil
}

func createToken(userID, email, role string) (string, error) {
token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
"user_id": userID,
"email":   email,
"role":    role,
"exp":     time.Now().Add(24 * time.Hour).Unix(),
})
return token.SignedString(jwtSecret)	
}

var _ = uuid.UUID{}
var _ = sql.Open
