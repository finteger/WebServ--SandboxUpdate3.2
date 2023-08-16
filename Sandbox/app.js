const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const fs = require('fs');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const Student = require('./student.js');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const Session = require('./session.js');
const Record = require('./record.js');
const swaggerjsdoc = require('swagger-jsdoc');
const swaggerui = require('swagger-ui-express');
const swaggerdocs = require('./swagger.js');
const rateLimit = require('express-rate-limit');



const app = express();

// Our secret key is a simple text string.
const secretKey = 'your_secret_key'; 


//Use the body-parser middleware
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: secretKey,
    resave: false,
    saveUninitialized: false,
}));

 const options = {

    definition: {
       openapi: "3.1.0",
       info: {
        title: "Attendance Project",
        version: "1.0.0",
        description:
        "Api docs for the attendance project.",
        license: {
            name: "License: MIT",
            url: "https://spdx.org/licenses/MIT.html",
        },
     },
     servers: [
        {
        url: "https://localhost:3000",
        }
      ]
    },
   apis: ["./*.js"]
};

const specs = swaggerjsdoc(options);

app.use(
"/api/docs",
swaggerui.serve,
swaggerui.setup(specs, {explorer: true})
)



app.set('views', './views');
app.set('view engine', 'ejs');

app.use(express.static('public'));
app.use(express.static('public/images'));
app.use(express.static('public/css'));

const url = `mongodb+srv://ToddN:Password@cluster0.7as6vrs.mongodb.net/students`;

const connectionParams={
    useNewUrlParser: true,
    useUnifiedTopology: true
}



mongoose.connect(url, connectionParams)
 .then(() => {
    console.log('Connected to MongoDB cluster.')
 })
 .catch((err) =>{
    console.log(`Error connecting to the database.n${err}`);
 });



//Rate limit function that limits requests to public API.
const apiLimiter = rateLimit({
windowsMS: 1 * 60 * 1000, //15 minutes
max: 15,
standardHeaders: true,
legacyHeaders: false,
});





 //High-level middleware function that verifies jwt.  
function authenticateToken(req, res, next){

    const token = req.cookies.jwt;

    if(token){

    jwt.verify(token, secretKey, (err, decoded) =>{

       if(err) {
        res.status(401).send('Invalid token');
       }    
       
       req.userId = decoded;

       next();
    })

} else {

res.status(401).send('You are not authorized to access this page!');

}
}








app.get('/', (req, res) => {

    try{
       res.render('login.ejs');

    } catch(err){

        res.send('Server error.  Please try again later.');

    }

});

//authenticateToken <--put middleware back in home route once done with home page

app.get('/home',  async (req, res) => {

    const students = await Record.find({});
    const maxAttendanceCount = Math.max(...students.map(r => r.attendanceCount));

   res.render('attendance.ejs', { students, maxAttendanceCount});

});




app.post('/login', async function(req, res, next){



   //shorthand: const {email, password} = req.body;

   const email = req.body.email;
   const password = req.body.password;

   //Find user in the database by email
   const user = await Student.findOne({ email });

   if(!user){
   //User not found
   res.status(401).send('Invalid username or password.');
   return;
   }


    //Create and sign JWT
    const unique = user._id.toString();


    const token = jwt.sign(unique, secretKey);

    //Set the token as a cookie
    res.cookie('jwt', token, {maxAge: 5 * 60 * 1000, httpOnly: true});


   req.session.userId = user._id.toString();
   req.session.time = Date.now();

   const session = new Session({
    session_id: req.session.userId,
    timestamp: req.session.time,
   });

   session.save();



   //Compare the provided password with the hashes password in the user object
   bcrypt.compare(password, user.password, (err, result) => {


   if (err){
       //Something went wrong during comparison
       console.error('Error while comparing passwords:', err);
       res.status(500).send('Internal server error');
       return;
   }

   
   if(!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
       return next(new Error('Invalid email address.'));
   }

   if(!password || password.length < 8){
       res.send('Password must be at least 8 characters.');
   }

   console.log(result);

   if(result){
      // Passwords match, login successful
       res.redirect('/home');

   } else {

       //Passwords do not match
       res.status(401).send('Invalid username or password'); 
     
    }

    });
});

app.post('/logout', (req, res) =>{

    res.clearCookie('jwt');
    
    req.session.userId = null;
    
    req.session.destroy((err) =>{
    
        if(err){
            console.error(err);
            res.status(500).send('Server error');
        } else {
            res.redirect('/');
        }
      
 });
});



app.get('/register', (req, res) =>{

res.render('register');

});


app.post('/register', async (req, res) => {

const {email, password, confirmPassword} = req.body;


const user  = await Student.findOne({email});

if(user){
    res.status(400).send('Username already exists.  Please try again.');
    return;
}


//Check if the passwords and confirm password match
if(password !== confirmPassword){
 res.status(400).send('Passwords do not match.');
 return;
}

//Hash the password before saving it
bcrypt.hash(req.body.password, 10, (err, hashedPassword) =>{

const user = new Student({
    email: req.body.email,
    password: hashedPassword,
});

user.save();

res.redirect('/login');

if (err){
   //Something went wrong during hashing
   console.error('Error while hashing password:', err);
   res.status(500).send('Internal server error');
    return;
}

});
});


app.post('/addstudent', (req, res) =>{

const student = new Record({
name: req.body.name,
email: req.body.email,
});

student.save();

res.redirect('/home');

});


app.post('/deletestudent',  async (req, res) => {

 const studentName = req.body.name;

    try{

     const result = await Record.deleteOne({ name: studentName });

     if(result.deletedCount === 0){
        res.status(404).send('Student not found');
     } else {
        //res.redirect('/home');
     }


    } catch (error){

    }

});



app.post('/updatestudent',  async (req, res) => {

    const  { attendanceDate } = req.body;
    const length = req.body.attendance ? req.body.attendance.length : 0;



       try{
   
        for(let i = 0; i < length; i++) {
            const studentId = req.body.attendance[i];
            const result = await Record.findByIdAndUpdate(
                studentId, 
                {
                $inc: {attendanceCount: 1},
                $set: {attendanceDate: new Date(attendanceDate)},
                },
                {new: true}, 
            ); 
        }

        res.redirect('/home');

       } catch (error){
   
        console.error(error);
        res.status(500).send('An error occurred while updating student records.');
       }
       
});


app.post('/reset', async (req, res) =>{

try{

    const students = await Record.find({});

    for (let i = 0; i < students.length; i++) {
        students[i].attendanceCount = 0;
        await students[i].save();

    }

    res.redirect('/home');

    } catch(error) {

    console.error(error);
    res.status(500).send('An error occurred while updating student records.');
}

});


app.get('/api/records', apiLimiter, async (req, res) =>{

    try{
        const records = await Record.find().exec();
        res.json(records);
    } catch(error) {
        console.error(error);
        res.status(500).json({error: 'An error occurred while fetching records.'});
    }

});

app.post('/api/addstudent', apiLimiter, async (req, res) =>{

    try{
       const {name, email} = req.body;

       //Create a new student record
       const student = new Record({
        name: name,
        email: email,
       });

       await student.save();

     res.status(200).json({message: 'Student added successfully', student: student});

    } catch(error) {
        console.error(error);
        res.status(500).json({error: 'An error occurred while fetching records.'});
    }


})






const port = 3000;

app.listen(port, () =>{

console.log(`Successfully connected to http://localhost:${port}`);

})
