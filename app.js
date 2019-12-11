const express = require('express');
const bodyParser = require('body-parser');
const Picture = require('./models/picture.model');
const User = require('./models/user.model');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + file.originalname);
    },
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
        cb(null, true);
    } else {
        cb(null, false);
    }
}

const upload = multer({
    storage,
    limits: {
        fileSize: 1024 * 1024 * 5
    },
    fileFilter
});

const app = express();

const verifySession = (req, res, next) => {
    let refreshToken = req.header('x-refresh-token');
    let _id = req.header('_id');

    User.findByIdAndToken(_id, refreshToken).then(user => {
        if (!user) {
            return Promise.reject({
                'error': 'User not found. Make sure that the refresh token and user id are correct.'
            });
        }

        req.user_id = user._id;
        req.userObject = user;
        req.refreshToken = refreshToken;

        let isSessionValid = false;
        
        user.sessions.forEach(session => {
            if (session.token === refreshToken) {
                if (User.hasRefreshTokenExpired(session.expiresAt) === false) {
                    isSessionValid = true;
                }
            }
        });

        if (isSessionValid) {
            next();
        } else {
            return Promise.reject({
                'error': 'Refresh token is expired or the session is invalid'
            });
        }
    }).catch(error => {
        res.status(401).send(error);
    });
}

const authenticate = (req, res, next) => {
    let token = req.header('x-access-token');
    console.log(token);

    jwt.verify(token, User.getJWTSecret(), (err, decoded) => {
        if (err) {
            res.status(401).send(err);
        } else {
            req.user_id = decoded._id;
            next();
        }
    });
}

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS, PUT, PATCH, DELETE');
    res.header('Access-Control-Allow-Headers',
               'Origin, X-Requested-With, Content-Type, Accept, x-access-token, x-refresh-token, _id');
    res.header('Access-Control-Expose-Headers', 'x-access-token, x-refresh-token');

    next();
});

app.use('/uploads', express.static('uploads'));
app.use(cors({ origin: 'http://localhost:4200' }));

app.post('/images', authenticate, upload.any('uploadedPicture'), async (req, res) => {
    try {
        const responce = await Picture.create({
            filename: req.files[0].path,
            _userId: req.user_id
        });   

        res.send(responce);
    } catch (error) {
        res.send(error);
    }
});

app.get('/images', authenticate, async (req, res) => {
    try {
        const filename = `uploads\\${req.query.filename}`;
        const picture = await Picture.findOne({ filename });

        if (picture) {
            fs.readFile(picture.filename, (err, file) => {
                if (err) {
                    res.send(err);
                }
    
                if (file) {
                    res.writeHead(200, { 'Content-Type': 'image/jpeg' });
                    res.end(file);
                }
            });
        } else {
            res.end();
        }
    } catch (error) {
        res.send(error);
    }
});

app.get('/all-images', authenticate, async (req, res) => {
    try {
        const pictures = await Picture.find({ _userId: req.user_id });        
        res.send(pictures);
    } catch (error) {
        res.send(error);
    }
});

app.get('/images/:id', async (req, res) => {
    const fileId = req.params.id;
    const picture = await Picture.findOne({ _id: fileId });
    const pictureName = picture.filename;

    fs.readFile(pictureName, (err, file) => {
        if (err) {
            console.error('ERROR: ', err);
        }

        res.writeHead(200, {'Content-Type': 'image/jpeg'});
        res.end(file);
    });
});

// sign-up
app.post('/users', (req, res) => {
    let body = req.body;
    let newUser = new User(body);
    
    newUser.save().then(() => {
        return newUser.createSession();
    }).then(refreshToken => {

        return newUser.generateAccessAuthToken().then(accessToken => {
            
            return { accessToken, refreshToken };
        });
    }).then(authTokens => {
        res.header('x-refresh-token', authTokens.refreshToken)
           .header('x-access-token', authTokens.accessToken)
           .send(newUser);
    }).catch(err => {
        res.status(400).send(err);
    });
});

// sign-in
app.post('/users/login', (req, res) => {
    let { email, password } = req.body;

    User.findByCredentials(email, password).then(user => {
        
        return user.createSession().then(refreshToken => {
            
            return user.generateAccessAuthToken().then(accessToken => {
                
                return { accessToken, refreshToken };
            });
        }).then(authTokens => {
            res.header('x-refresh-token', authTokens.refreshToken)
               .header('x-access-token', authTokens.accessToken)
               .send(user);
        });
    }).catch(err => {
        res.status(400).send(err);
    });
});

// generates and returns access token
app.get('/users/me/access-token', verifySession, (req, res) => {
    req.userObject.generateAccessAuthToken().then(accessToken => {
        res.header('x-access-token', accessToken).send({ accessToken });
    }).catch(err => {
        res.status(400).send(err);
    });
});

module.exports = app;