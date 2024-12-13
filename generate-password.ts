import bcrypt from 'bcrypt';

const password = '';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
        console.error('Error generating hash:', err);
        return;
    }
    console.log('Use this hash as HASHED_PASSWORD:', hash);
});