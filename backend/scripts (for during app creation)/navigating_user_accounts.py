# just for easy changing of account details as needed
# gives the hashed version of whatever password we want to use --> can edit the test.db
from passlib.context import CryptContext
import hashlib

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def get_password_hash(password: str):
    return pwd_context.hash(password)

# change the string here
print(get_password_hash("mypassword"))