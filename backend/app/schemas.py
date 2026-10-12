from pydantic import BaseModel, EmailStr, Field

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    email: str

class TextScanIn(BaseModel):
    text: str = Field(min_length=1, max_length=500_000)
    filename: str = Field(default="Pasted text", max_length=255)
