require('dotenv').config();
console.log("Email User loaded:", process.env.EMAIL_USER);
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const app = express();
const PORT = process.env.PORT || 3000;

let maintenanceMode = false;

// Schemas
const bookSchema = new mongoose.Schema({
    bookName: String,
    bookAuthor: String,
    bookPages: Number,
    bookPrice: Number,
    bookPublication: String,
    bookGenre: String,
    bookCover: String,
    bookState: { type: String, default: "Available" },
    quantity: { type: Number, default: 10 },
    issued: { type: Number, default: 0 }
});

// Multer Setup for Image Uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = './public/uploads';
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, 'cover-' + Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5000000 }, // 5MB limit
    fileFilter: (req, file, cb) => { checkFileType(file, cb); }
});

function checkFileType(file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    cb('Error: Images Only!');
}

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    originalUsername: String,
    password: { type: String, required: true },
    lockUntil: { type: Number, default: null },
    failedLoginAttempts: { type: Number, default: 0 },
    totalFailedAttempts: { type: Number, default: 0 },
    fines: { type: Number, default: 0 },
    role: { type: String, default: "User" },
    isDeleted: { type: Boolean, default: false },
    profilePic: String,
    issuedBooks: [{
        bookName: String,
        borrowerName: String,
        borrowerPhone: String,
        issueDate: { type: Date, default: Date.now }
    }],
    returnHistory: [{
        bookName: String,
        borrowerName: String,
        borrowerPhone: String,
        issueDate: Date,
        returnDate: { type: Date, default: Date.now },
        fine: { type: Number, default: 0 }
    }]
});

const Book = mongoose.model("Book", bookSchema);
const User = mongoose.model("User", userSchema);

// Connect to MongoDB and Seed Data
const mongoURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/libraryDB";

// Monitor Connection Events
mongoose.connection.on('connected', () => console.log('Mongoose connected to DB Cluster'));
mongoose.connection.on('error', (err) => console.error('Mongoose connection error:', err));
mongoose.connection.on('disconnected', () => console.log('Mongoose disconnected'));

mongoose.connect(mongoURI)
    .then(async () => {
        console.log("Connected to MongoDB");
        
        // Check if books exist, if not add sample data
        const count = await Book.countDocuments();
        const initialBooks = [
                {
                    bookName: "Rudest Book Ever",
                    bookAuthor: "Shwetabh Gangwar",
                    bookPages: 200,
                    bookPrice: 240,
                    bookPublication: "XYZ Publishers",
                    bookGenre: "Self-Help",
                    bookState: "Available"
                },
                {
                    bookName: "Atomic Habits",
                    bookAuthor: "James Clear",
                    bookPages: 320,
                    bookPrice: 300,
                    bookPublication: "Penguin Random House",
                    bookGenre: "Self-Help",
                    bookState: "Available"
                },
                {
                    bookName: "Deep Work",
                    bookAuthor: "Cal Newport",
                    bookPages: 304,
                    bookPrice: 350,
                    bookPublication: "Grand Central Publishing",
                    bookGenre: "Productivity",
                    bookState: "Available"
                },
                {
                    bookName:"The Power of Habit",
                    bookAuthor: "Charles Duhigg",
                    bookPages: 371,
                    bookPrice: 280,
                    bookPublication: "Random House",
                    bookGenre: "Self-Help",
                    bookState: "Available"
                },
                {
                    bookName: "Thinking, Fast and Slow",
                    bookAuthor: "Daniel Kahneman",
                    bookPages: 499,
                    bookPrice: 400,
                    bookPublication: "Farrar, Straus and Giroux",
                    bookGenre: "Psychology",
                    bookState: "Available"
                },
                {
                    bookName: "Grit: The Power of Passion and Perseverance",
                    bookAuthor: "Angela Duckworth",
                    bookPages: 352, 
                    bookPrice: 320,
                    bookPublication: "Scribner",
                    bookGenre: "Psychology",
                    bookState: "Available"
                },
                {
                    bookName: "Mindset: The New Psychology of Success",
                    bookAuthor: "Carol S. Dweck",
                    bookPages: 320,
                    bookPrice: 290,
                    bookPublication: "Random House",
                    bookGenre: "Psychology",
                    bookState: "Available"
                },
                {
                    bookName: "The 7 Habits of Highly Effective People",
                    bookAuthor: "Stephen R. Covey",
                    bookPages: 381,
                    bookPrice: 360,
                    bookPublication: "Free Press",
                    bookGenre: "Self-Help",
                    bookState: "Available"
                },
                {
                    bookName: "Drive: The Surprising Truth About What Motivates Us",
                    bookAuthor: "Daniel H. Pink",
                    bookPages: 272,
                    bookPrice: 310,
                    bookPublication: "Riverhead Books",
                    bookGenre: "Psychology",
                    bookState: "Available"
                },
                {
                    bookName: "The Subtle Art of Not Giving a F*ck",
                    bookAuthor: "Mark Manson",
                    bookPages: 224,
                    bookPrice: 250,
                    bookPublication: "Harper",
                    bookGenre: "Self-Help",
                    bookState: "Available"
                },
                {
                    bookName: "Outliers: The Story of Success",
                    bookAuthor: "Malcolm Gladwell",
                    bookPages: 336,
                    bookPrice: 330,
                    bookPublication: "Little, Brown and Company",
                    bookGenre: "Psychology",
                    bookState: "Available"
                },
                {
                    bookName: "Quiet: The Power of Introverts in a World That Can't Stop Talking",
                    bookAuthor: "Susan Cain",
                    bookPages: 368,
                    bookPrice: 340,
                    bookPublication: "Crown Publishing Group",
                    bookGenre: "Psychology",
                    bookState: "Available"
                },
                {
                    bookName: "The Four Agreements",
                    bookAuthor: "Don Miguel Ruiz",
                    bookPages: 160,
                    bookPrice: 220,
                    bookPublication: "Amber-Allen Publishing",
                    bookGenre: "Self-Help",
                    bookState: "Available"
                },
                {
                    bookName: "Flow: The Psychology of Optimal Experience",
                    bookAuthor: "Mihaly Csikszentmihalyi",
                    bookPages: 336,
                    bookPrice: 300,
                    bookPublication: "Harper & Row",
                    bookGenre: "Psychology",
                    bookState: "Available"
                },
                {
                    bookName: "Emotional Intelligence",
                    bookAuthor: "Daniel Goleman",
                    bookPages: 352,
                    bookPrice: 350,
                    bookPublication: "Bantam Books",
                    bookGenre: "Psychology",
                    bookState: "Available"
                },
                {
                    bookName: "The Happiness Advantage",
                    bookAuthor: "Shawn Achor",
                    bookPages: 256,
                    bookPrice: 280,
                    bookPublication: "Crown Business",
                    bookGenre: "Self-Help",
                    bookState: "Available"
                },
                {
                    bookName: "Dare to Lead",
                    bookAuthor: "Brené Brown",
                    bookPages: 320,
                    bookPrice: 360,
                    bookPublication: "Random House",
                    bookGenre: "Business",
                    bookState: "Available"
                },
                {
                    bookName: "Start with Why",
                    bookAuthor: "Simon Sinek",
                    bookPages: 256,
                    bookPrice: 300,
                    bookPublication: "Portfolio",
                    bookGenre: "Business",
                    bookState: "Available"
                },
                {
                    bookName: "The Lean Startup",
                    bookAuthor: "Eric Ries",
                    bookPages: 336,
                    bookPrice: 320,
                    bookPublication: "Crown Business",
                    bookGenre: "Business",
                    bookState: "Available"
                },
                {
                    bookName: "Good to Great",
                    bookAuthor: "Jim Collins",
                    bookPages: 320,
                    bookPrice: 340,
                    bookPublication: "HarperBusiness",
                    bookGenre: "Business",
                    bookState: "Available"
                },
                {
                    bookName: "Zero to One",
                    bookAuthor: "Peter Thiel",
                    bookPages: 224,
                    bookPrice: 310,
                    bookPublication: "Crown Business",
                    bookGenre: "Business",
                    bookState: "Available"
                },
                {
                    bookName: "The Hard Thing About Hard Things",
                    bookAuthor: "Ben Horowitz",
                    bookPages: 304,
                    bookPrice: 330,
                    bookPublication: "HarperBusiness",
                    bookGenre: "Business",
                    bookState: "Available"
                },
                {
                    bookName: "Measure What Matters",
                    bookAuthor: "John Doerr",
                    bookPages: 320,
                    bookPrice: 350,
                    bookPublication: "Portfolio",
                    bookGenre: "Business",
                    bookState: "Available"
                },
                {
                    bookName: "Thinking in Bets",
                    bookAuthor: "Annie Duke",
                    bookPages: 304,
                    bookPrice: 290,
                    bookPublication: "Portfolio",
                    bookGenre: "Business",
                    bookState: "Available"
                },
                {
                    bookName: "Principles: Life and Work",
                    bookAuthor: "Ray Dalio",
                    bookPages: 592,
                    bookPrice: 400,
                    bookPublication: "Simon & Schuster",
                    bookGenre: "Business",
                    bookState: "Available"
                },
                {
                    bookName: "The Innovator's Dilemma",
                    bookAuthor: "Clayton M. Christensen",
                    bookPages: 286,
                    bookPrice: 320,
                    bookPublication: "Harvard Business Review Press",
                    bookGenre: "Business",
                    bookState: "Available"
                },
                {
                    bookName: "Blue Ocean Strategy",
                    bookAuthor: "W. Chan Kim & Renée Mauborgne",
                    bookPages: 256,
                    bookPrice: 300,
                    bookPublication: "Harvard Business Review Press",
                    bookGenre: "Business",
                    bookState: "Available"
                },
                {
                    bookName: "The E-Myth Revisited",
                    bookAuthor: "Michael E. Gerber",
                    bookPages: 288,
                    bookPrice: 280,
                    bookPublication: "HarperCollins",
                    bookGenre: "Business",
                    bookState: "Available"
                },
                {
                    bookName: "Crushing It!",
                    bookAuthor: "Gary Vaynerchuk",
                    bookPages: 288,
                    bookPrice: 310,
                    bookPublication: "HarperBusiness",
                    bookGenre: "Business",
                    bookState: "Available"
                },
                {
                    bookName: "Jab, Jab, Jab, Right Hook",
                    bookAuthor: "Gary Vaynerchuk",
                    bookPages: 240,
                    bookPrice: 270,
                    bookPublication: "HarperBusiness",
                    bookGenre: "Business",
                    bookState: "Available"
                },
                {
                    bookName: "Contagious: How to Build Word of Mouth in the Digital Age",
                    bookAuthor: "Jonah Berger",
                    bookPages: 256,
                    bookPrice: 290,
                    bookPublication: "Simon & Schuster",
                    bookGenre: "Business",
                    bookState: "Available"
                },
                {
                    bookName: "Made to Stick",
                    bookAuthor: "Chip Heath & Dan Heath",
                    bookPages: 336,
                    bookPrice: 300,
                    bookPublication: "Random House",
                    bookGenre: "Business",
                    bookState: "Available"
                },
                {
                    bookName: "Influence: The Psychology of Persuasion",
                    bookAuthor: "Robert B. Cialdini",
                    bookPages: 336,
                    bookPrice: 320,
                    bookPublication: "Harper Business",
                    bookGenre: "Psychology",
                    bookState: "Available"
                },
                {
                    bookName: "Pre-Suasion: A Revolutionary Way to Influence and Persuade",
                    bookAuthor: "Robert B. Cialdini",
                    bookPages: 432,
                    bookPrice: 350,
                    bookPublication: "Simon & Schuster",
                    bookGenre: "Psychology",
                    bookState: "Available"

                },
                {
                    bookName: "Switch: How to Change Things When Change Is Hard",
                    bookAuthor: "Chip Heath & Dan Heath",
                    bookPages: 320,
                    bookPrice: 300,
                    bookPublication: "Broadway Books",
                    bookGenre: "Psychology",
                    bookState: "Available"
                },
                {
                    bookName: "The Art of Thinking Clearly",
                    bookAuthor: "Rolf Dobelli",
                    bookPages: 384,
                    bookPrice: 280,
                    bookPublication: "HarperBusiness",
                    bookGenre: "Psychology",
                    bookState: "Available"
                },
                {
                    bookName: "Nudge: Improving Decisions About Health, Wealth, and Happiness",
                    bookAuthor: "Richard H. Thaler & Cass R. Sunstein",
                    bookPages: 312,
                    bookPrice: 320,
                    bookPublication: "Penguin Books",
                    bookGenre: "Psychology",
                    bookState: "Available"
                },
                {
                    bookName: "Predictably Irrational",
                    bookAuthor: "Dan Ariely",
                    bookPages: 384,
                    bookPrice: 300,
                    bookPublication: "HarperCollins",
                    bookGenre: "Psychology",
                    bookState: "Available"
                },
                {
                    bookName: "Misbehaving: The Making of Behavioral Economics",
                    bookAuthor: "Richard H. Thaler",
                    bookPages: 432,
                    bookPrice: 350,
                    bookPublication: "W. W. Norton & Company",
                    bookGenre: "Economics",
                    bookState: "Available"
                },
                {
                    bookName: "Thinking in Systems: A Primer",
                    bookAuthor: "Donella H. Meadows",
                    bookPages: 240,
                    bookPrice: 270,
                    bookPublication: "Chelsea Green Publishing",
                    bookGenre: "Science",
                    bookState: "Available"
                },
                {
                    bookName: "The Fifth Discipline: The Art & Practice of The Learning Organization",
                    bookAuthor: "Peter M. Senge",
                    bookPages: 424,
                    bookPrice: 380,
                    bookPublication: "Doubleday",
                    bookGenre: "Business",
                    bookState: "Available"
                },
                {
                    bookName: "Antifragile: Things That Gain from Disorder",
                    bookAuthor: "Nassim Nicholas Taleb",
                    bookPages: 519,
                    bookPrice: 400,
                    bookPublication: "Random House",
                    bookGenre: "Philosophy",
                    bookState: "Available"
                },
                {
                    bookName: "Skin in the Game: Hidden Asymmetries in Daily Life",
                    bookAuthor: "Nassim Nicholas Taleb",
                    bookPages: 304,
                    bookPrice: 320,
                    bookPublication: "Random House",
                    bookGenre: "Philosophy",
                    bookState: "Available"
                },
                {
                    bookName: "Fooled by Randomness: The Hidden Role of Chance in Life and in the Markets",
                    bookAuthor: "Nassim Nicholas Taleb",
                    bookPages: 316,
                    bookPrice: 300,
                    bookPublication: "Random House",
                    bookGenre: "Philosophy",
                    bookState: "Available"
                },
                {
                    bookName: "The Black Swan: The Impact of the Highly Improbable",
                    bookAuthor: "Nassim Nicholas Taleb",
                    bookPages: 444,
                    bookPrice: 350,
                    bookPublication: "Random House",
                    bookGenre: "Philosophy",
                    bookState: "Available"
                },
                {
                    bookName: "Learning from Data",
                    bookAuthor: "Yaser S. Abu-Mostafa, Malik Magdon-Ismail, Hsuan-Tien Lin",
                    bookPages: 312,
                    bookPrice: 330,
                    bookPublication: "AMLBook",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Pattern Recognition and Machine Learning",
                    bookAuthor: "Christopher M. Bishop",
                    bookPages: 738,
                    bookPrice: 450,
                    bookPublication: "Springer",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Deep Learning",
                    bookAuthor: "Ian Goodfellow, Yoshua Bengio, Aaron Courville",
                    bookPages: 800,
                    bookPrice: 500,
                    bookPublication: "MIT Press",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Artificial Intelligence: A Modern Approach",
                    bookAuthor: "Stuart Russell, Peter Norvig",
                    bookPages: 1152,
                    bookPrice: 550,
                    bookPublication: "Pearson",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Reinforcement Learning: An Introduction",
                    bookAuthor: "Richard S. Sutton, Andrew G. Barto",
                    bookPages: 552, 
                    bookPrice: 400,
                    bookPublication: "MIT Press",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "The Elements of Statistical Learning",
                    bookAuthor: "Trevor Hastie, Robert Tibshirani, Jerome Friedman",
                    bookPages: 745,
                    bookPrice: 450,
                    bookPublication: "Springer",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Data Science for Business",
                    bookAuthor: "Foster Provost, Tom Fawcett",
                    bookPages: 414,
                    bookPrice: 350,
                    bookPublication: "O'Reilly Media",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Python Machine Learning",
                    bookAuthor: "Sebastian Raschka, Vahid Mirjalili",
                    bookPages: 770,
                    bookPrice: 400,
                    bookPublication: "Packt Publishing",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow",
                    bookAuthor: "Aurélien Géron",
                    bookPages: 850,
                    bookPrice: 450,
                    bookPublication: "O'Reilly Media",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Machine Learning Yearning",
                    bookAuthor: "Andrew Ng",
                    bookPages: 200,
                    bookPrice: 300,
                    bookPublication: "Self-published",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Introduction to Machine Learning with Python",
                    bookAuthor: "Andreas C. Müller, Sarah Guido",
                    bookPages: 400,
                    bookPrice: 350,
                    bookPublication: "O'Reilly Media",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Mining of Massive Datasets",
                    bookAuthor: "Jure Leskovec, Anand Rajaraman, Jeffrey D. Ullman",
                    bookPages: 500,
                    bookPrice: 400,
                    bookPublication: "Cambridge University Press",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "The Hundred-Page Machine Learning Book",
                    bookAuthor: "Andriy Burkov",
                    bookPages: 100,
                    bookPrice: 250,
                    bookPublication: "Andriy Burkov",
                    bookGenre: "Computer Science",
                    bookState: "Available"

                },
                {
                    bookName: "Grokking Deep Learning",
                    bookAuthor: "Andrew W. Trask",
                    bookPages: 300,
                    bookPrice: 350,
                    bookPublication: "Manning Publications",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Bayesian Reasoning and Machine Learning",
                    bookAuthor: "David Barber",
                    bookPages: 600,
                    bookPrice: 450,
                    bookPublication: "Cambridge University Press",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Probabilistic Graphical Models: Principles and Techniques",
                    bookAuthor: "Daphne Koller, Nir Friedman",
                    bookPages: 1200,
                    bookPrice: 600,
                    bookPublication: "MIT Press",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Speech and Language Processing",
                    bookAuthor: "Daniel Jurafsky, James H. Martin",
                    bookPages: 1000,
                    bookPrice: 550,
                    bookPublication: "Pearson",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Computer Vision: Algorithms and Applications",
                    bookAuthor: "Richard Szeliski",
                    bookPages: 812,
                    bookPrice: 500,
                    bookPublication: "Springer",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                }
                ,
                {
                    bookName: "Pattern Recognition",
                    bookAuthor: "Sergios Theodoridis, Konstantinos Koutroumbas",
                    bookPages: 800,
                    bookPrice: 450,
                    bookPublication: "Academic Press",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Data Mining: Concepts and Techniques",
                    bookAuthor: "Jiawei Han, Micheline Kamber, Jian Pei",
                    bookPages: 800,
                    bookPrice: 450,
                    bookPublication: "Morgan Kaufmann",
                    bookGenre: "Computer Science",
                    bookState: "Available"

                },
                {
                    bookName: "An Introduction to Statistical Learning",
                    bookAuthor: "Gareth James, Daniela Witten, Trevor Hastie, Robert Tibshirani",
                    bookPages: 426,
                    bookPrice: 350,
                    bookPublication: "Springer",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "The Master Algorithm",
                    bookAuthor: "Pedro Domingos",
                    bookPages: 352,
                    bookPrice: 300,
                    bookPublication: "Basic Books",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Machine Learning: A Probabilistic Perspective",
                    bookAuthor: "Kevin P. Murphy",
                    bookPages: 1104,
                    bookPrice: 600,
                    bookPublication: "MIT Press",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Artificial Intelligence and Machine Learning for Business",
                    bookAuthor: "Steven Finlay",
                    bookPages: 250,
                    bookPrice: 300,
                    bookPublication: "Wiley",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Data Science from Scratch",
                    bookAuthor: "Joel Grus",
                    bookPages: 330,
                    bookPrice: 320,
                    bookPublication: "O'Reilly Media",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "The Data Warehouse Toolkit",
                    bookAuthor: "Ralph Kimball, Margy Ross",
                    bookPages: 552,
                    bookPrice: 400,
                    bookPublication: "Wiley",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Big Data: Principles and Best Practices of Scalable Real-Time Data Systems",
                    bookAuthor: "Nathan Marz, James Warren",
                    bookPages: 300,
                    bookPrice: 350,
                    bookPublication: "Manning Publications",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Hadoop: The Definitive Guide",
                    bookAuthor: "Tom White",
                    bookPages: 600,
                    bookPrice: 450,
                    bookPublication: "O'Reilly Media",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Spark: The Definitive Guide",
                    bookAuthor: "Bill Chambers, Matei Zaharia",
                    bookPages: 552,
                    bookPrice: 450,
                    bookPublication: "O'Reilly Media",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "NoSQL Distilled: A Brief Guide to the Emerging World of Polyglot Persistence",
                    bookAuthor: "Pramod J. Sadalage, Martin Fowler",
                    bookPages: 176,
                    bookPrice: 300,
                    bookPublication: "Addison-Wesley Professional",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Designing Data-Intensive Applications",
                    bookAuthor: "Martin Kleppmann",
                    bookPages: 616,
                    bookPrice: 500,
                    bookPublication: "O'Reilly Media",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Streaming Systems: The What, Where, When, and How of Large-Scale Data Processing",
                    bookAuthor: "Tyler Akidau, Slava Chernyak, Reuven Lax",
                    bookPages: 400,
                    bookPrice: 450,
                    bookPublication: "O'Reilly Media",
                    bookGenre: "Computer Science",
                    bookState: "Available"
                },
                {
                    bookName: "Game of Thrones",
                    bookAuthor: "George R. R. Martin",
                    bookPages: 694,
                    bookPrice: 500,
                    bookPublication: "Bantam Spectra",
                    bookGenre: "Fantasy",
                    bookState: "Available"
                },
                {
                    bookName: "To Kill a Mockingbird",
                    bookAuthor: "Harper Lee",
                    bookPages: 281,
                    bookPrice: 300,
                    bookPublication: "J.B. Lippincott & Co.",
                    bookGenre: "Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "1984",
                    bookAuthor: "George Orwell",
                    bookPages: 328,
                    bookPrice: 350,
                    bookPublication: "Secker & Warburg",
                    bookGenre: "Fiction",
                    bookState: "Available"
                }
                ,
                {
                    bookName: "The Great Gatsby",
                    bookAuthor: "F. Scott Fitzgerald",
                    bookPages: 180,
                    bookPrice: 250,
                    bookPublication: "Charles Scribner's Sons",
                    bookGenre: "Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "The Catch-22",
                    bookAuthor: "Joseph Heller",
                    bookPages: 453,
                    bookPrice: 400,
                    bookPublication: "Simon & Schuster",
                    bookGenre: "Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "The Lord of the Rings",
                    bookAuthor: "J.R.R. Tolkien",
                    bookPages: 1216,
                    bookPrice: 600,
                    bookPublication: "Allen & Unwin",
                    bookGenre: "Fantasy",
                    bookState: "Available"
                },
                {
                    bookName: "Pride and Prejudice",
                    bookAuthor: "Jane Austen",
                    bookPages: 279,
                    bookPrice: 300,
                    bookPublication: "T. Egerton, Whitehall",
                    bookGenre: "Romance",
                    bookState: "Available"
                },
                {
                    bookName: "The Hobbit",
                    bookAuthor: "J.R.R. Tolkien",
                    bookPages: 310,
                    bookPrice: 350,
                    bookPublication: "Allen & Unwin",
                    bookGenre: "Fantasy",
                    bookState: "Available"
                },
                {
                    bookName: "Fahrenheit 451",
                    bookAuthor: "Ray Bradbury",
                    bookPages: 194,
                    bookPrice: 280,
                    bookPublication: "Ballantine Books",
                    bookGenre: "Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "Jane Eyre",
                    bookAuthor: "Charlotte Brontë",
                    bookPages: 500,
                    bookPrice: 400,
                    bookPublication: "Smith, Elder & Co.",
                    bookGenre: "Romance",
                    bookState: "Available"
                },
                {
                    bookName: "Brave New World",
                    bookAuthor: "Aldous Huxley",
                    bookPages: 311,
                    bookPrice: 350,
                    bookPublication: "Chatto & Windus",
                    bookGenre: "Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "Animal Farm",
                    bookAuthor: "George Orwell",
                    bookPages: 112,
                    bookPrice: 200,
                    bookPublication: "Secker & Warburg",
                    bookGenre: "Fiction",
                    bookState: "Available"

                },
                {
                    bookName: "Wuthering Heights",
                    bookAuthor: "Emily Brontë",
                    bookPages: 416,
                    bookPrice: 380,
                    bookPublication: "Thomas Cautley Newby",
                    bookGenre: "Romance",
                    bookState: "Available"
                },
                {
                    bookName: "The Chronicles of Narnia",
                    bookAuthor: "C.S. Lewis",
                    bookPages: 767,
                    bookPrice: 550,
                    bookPublication: "Geoffrey Bles",
                    bookGenre: "Fantasy",
                    bookState: "Available"
                },
                {
                    bookName: "The Picture of Dorian Gray",
                    bookAuthor: "Oscar Wilde",
                    bookPages: 254,
                    bookPrice: 300,
                    bookPublication: "Lippincott's Monthly Magazine",
                    bookGenre: "Fiction",
                    bookState: "Available"

                },
                {
                    bookName: "Dracula",
                    bookAuthor: "Bram Stoker",
                    bookPages: 418,
                    bookPrice: 400,
                    bookPublication: "Archibald Constable and Company",
                    bookGenre: "Horror",
                    bookState: "Available"
                },
                {
                    bookName: "The Count of Monte Cristo",
                    bookAuthor: "Alexandre Dumas",
                    bookPages: 1276,
                    bookPrice: 650,
                    bookPublication: "Penguin Classics",
                    bookGenre: "Adventure",
                    bookState: "Available"

                },
                {
                    bookName: "Les Misérables",
                    bookAuthor: "Victor Hugo",
                    bookPages: 1463,
                    bookPrice: 700,
                    bookPublication: "A. Lacroix, Verboeckhoven & Cie.",
                    bookGenre: "Historical Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "The Odyssey",
                    bookAuthor: "Homer",
                    bookPages: 541,
                    bookPrice: 450,
                    bookPublication: "Penguin Classics",
                    bookGenre: "Classics",
                    bookState: "Available"
                },
                {
                    bookName: "Moby-Dick",
                    bookAuthor: "Herman Melville",
                    bookPages: 585,
                    bookPrice: 400,
                    bookPublication: "Harper & Brothers",
                    bookGenre: "Adventure",
                    bookState: "Available"
                },
                {
                    bookName: "War and Peace",
                    bookAuthor: "Leo Tolstoy",
                    bookPages: 1225,
                    bookPrice: 700,
                    bookPublication: "The Russian Messenger",
                    bookGenre: "Historical Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "Crime and Punishment",
                    bookAuthor: "Fyodor Dostoevsky",
                    bookPages: 671,
                    bookPrice: 500,
                    bookPublication: "The Russian Messenger",
                    bookGenre: "Classics",
                    bookState: "Available"

                },
                {
                    bookName: "The Brothers Karamazov",
                    bookAuthor: "Fyodor Dostoevsky",
                    bookPages: 824,
                    bookPrice: 550,
                    bookPublication: "The Russian Messenger",
                    bookGenre: "Classics",
                    bookState: "Available"
                },
                {
                    bookName: "Madame Bovary",
                    bookAuthor: "Gustave Flaubert",
                    bookPages: 329,
                    bookPrice: 350,
                    bookPublication: "Revue de Paris",
                    bookGenre: "Classics",
                    bookState: "Available"

                },
                {
                    bookName: "The Divine Comedy",
                    bookAuthor: "Dante Alighieri",
                    bookPages: 798,
                    bookPrice: 600,
                    bookPublication: "John Murray",
                    bookGenre: "Classics",
                    bookState: "Available"
                },
                {
                    bookName: "Hamlet",
                    bookAuthor: "William Shakespeare",
                    bookPages: 342,
                    bookPrice: 300,
                    bookPublication: "N/A",
                    bookGenre: "Drama",
                    bookState: "Available"
                },
                {
                    bookName: "The Adventures of Huckleberry Finn",
                    bookAuthor: "Mark Twain",
                    bookPages: 366,
                    bookPrice: 350,
                    bookPublication: "Chatto & Windus / Charles L. Webster And Company",
                    bookGenre: "Adventure",
                    bookState: "Available"
                },
                {
                    bookName: "The Iliad",
                    bookAuthor: "Homer",
                    bookPages: 683,
                    bookPrice: 450,
                    bookPublication: "Penguin Classics",
                    bookGenre: "Classics",
                    bookState: "Available"
                },
                {
                    bookName: "Don Quixote",
                    bookAuthor: "Miguel de Cervantes",
                    bookPages: 1072,
                    bookPrice: 650,
                    bookPublication: "Francisco de Robles",
                    bookGenre: "Adventure",
                    bookState: "Available"
                },
                {
                    bookName: "One Hundred Years of Solitude",
                    bookAuthor: "Gabriel García Márquez",
                    bookPages: 417,
                    bookPrice: 400,
                    bookPublication: "Harper & Row",
                    bookGenre: "Magical Realism",
                    bookState: "Available"
                },
                {
                    bookName: "The Sound and the Fury",
                    bookAuthor: "William Faulkner",
                    bookPages: 326,
                    bookPrice: 350,
                    bookPublication: "Jonathan Cape and Harrison Smith",
                    bookGenre: "Classics",
                    bookState: "Available"

                },
                {
                    bookName: "Great Expectations",
                    bookAuthor: "Charles Dickens",
                    bookPages: 505,
                    bookPrice: 450,
                    bookPublication: "Chapman & Hall",
                    bookGenre: "Classics",
                    bookState: "Available"
                },
                {
                    bookName: "Lolita",
                    bookAuthor: "Vladimir Nabokov",
                    bookPages: 336,
                    bookPrice: 350,
                    bookPublication: "Olympia Press",
                    bookGenre: "Classics",
                    bookState: "Available"
                },
                {
                    bookName: "Catch-22",
                    bookAuthor: "Joseph Heller",
                    bookPages: 453,
                    bookPrice: 400,
                    bookPublication: "Simon & Schuster",
                    bookGenre: "Satire",
                    bookState: "Available"
                }
                ,{
                    bookName: "Slaughterhouse-Five",
                    bookAuthor: "Kurt Vonnegut",
                    bookPages: 215,
                    bookPrice: 300,
                    bookPublication: "Delacorte Press",
                    bookGenre: "Sci-Fi",
                    bookState: "Available"
                },
                {
                    bookName: "The Grapes of Wrath",
                    bookAuthor: "John Steinbeck",
                    bookPages: 464,
                    bookPrice: 450,
                    bookPublication: "The Viking Press-James Lloyd",
                    bookGenre: "Historical Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "Invisible Man",
                    bookAuthor: "Ralph Ellison",
                    bookPages: 581,
                    bookPrice: 500,
                    bookPublication: "Random House",
                    bookGenre: "Classics",
                    bookState: "Available"

                },
                {
                    bookName: "Beloved",
                    bookAuthor: "Toni Morrison",
                    bookPages: 324,
                    bookPrice: 400,
                    bookPublication: "Alfred A. Knopf",
                    bookGenre: "Historical Fiction",
                    bookState: "Available"

                },
                {
                    bookName: "Mrs. Dalloway",
                    bookAuthor: "Virginia Woolf",
                    bookPages: 194,
                    bookPrice: 300,
                    bookPublication: "Hogarth Press",
                    bookGenre: "Classics",
                    bookState: "Available"
                },
                {
                    bookName: "Heart of Darkness",
                    bookAuthor: "Joseph Conrad",
                    bookPages: 152,
                    bookPrice: 250,
                    bookPublication: "Blackwood's Magazine",
                    bookGenre: "Classics",
                    bookState: "Available"
                },
                {
                    bookName: "The Metamorphosis",
                    bookAuthor: "Franz Kafka",
                    bookPages: 201,
                    bookPrice: 300,
                    bookPublication: "Kurt Wolff Verlag",
                    bookGenre: "Classics",
                    bookState: "Available"
                },
                {
                    bookName: "The Stranger",
                    bookAuthor: "Albert Camus",
                    bookPages: 123,
                    bookPrice: 250,
                    bookPublication: "Gallimard",
                    bookGenre: "Philosophy",
                    bookState: "Available"
                },
                {
                    bookName: "A Tale of Two Cities",
                    bookAuthor: "Charles Dickens",
                    bookPages: 489,
                    bookPrice: 400,
                    bookPublication: "Chapman & Hall",
                    bookGenre: "Historical Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "Don Quixote",
                    bookAuthor: "Miguel de Cervantes",
                    bookPages: 1072,
                    bookPrice: 650,
                    bookPublication: "Francisco de Robles",
                    bookGenre: "Adventure",
                    bookState: "Available"
                },
                {
                    bookName: "Ulysses",
                    bookAuthor: "James Joyce",
                    bookPages: 730,
                    bookPrice: 600,
                    bookPublication: "Sylvia Beach",
                    bookGenre: "Classics",
                    bookState: "Available"
                },
                {
                    bookName: "The Old Man and the Sea",
                    bookAuthor: "Ernest Hemingway",
                    bookPages: 127,
                    bookPrice: 250,
                    bookPublication: "Charles Scribner's Sons",
                    bookGenre: "Classics",
                    bookState: "Available"
                },
                {
                    bookName: "The Sun Also Rises",
                    bookAuthor: "Ernest Hemingway",
                    bookPages: 251,
                    bookPrice: 300,
                    bookPublication: "Charles Scribner's Sons",
                    bookGenre: "Classics",
                    bookState: "Available"
                }
                ,
                {
                    bookName: "A Farewell to Arms",
                    bookAuthor: "Ernest Hemingway",
                    bookPages: 355,
                    bookPrice: 350,
                    bookPublication: "Charles Scribner's Sons",
                    bookGenre: "Historical Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "For Whom the Bell Tolls",
                    bookAuthor: "Ernest Hemingway",
                    bookPages: 480,
                    bookPrice: 400,
                    bookPublication: "Charles Scribner's Sons",
                    bookGenre: "Historical Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "The Canterbury Tales",
                    bookAuthor: "Geoffrey Chaucer",
                    bookPages: 432,
                    bookPrice: 400,
                    bookPublication: "N/A",
                    bookGenre: "Classics",
                    bookState: "Available"
                },
                {
                    bookName: "Macbeth",
                    bookAuthor: "William Shakespeare",
                    bookPages: 146,
                    bookPrice: 250,
                    bookPublication: "N/A",
                    bookGenre: "Drama",
                    bookState: "Available"
                },
                {
                    bookName: "Othello",
                    bookAuthor: "William Shakespeare",
                    bookPages: 203,
                    bookPrice: 300,
                    bookPublication: "N/A",
                    bookGenre: "Drama",
                    bookState: "Available"
                },
                {
                    bookName: "Romeo and Juliet",
                    bookAuthor: "William Shakespeare",
                    bookPages: 279,
                    bookPrice: 300,
                    bookPublication: "N/A",
                    bookGenre: "Drama",
                    bookState: "Available"

                },
                {
                    bookName: "A Midsummer Night's Dream",
                    bookAuthor: "William Shakespeare",
                    bookPages: 200,
                    bookPrice: 250,
                    bookPublication: "N/A",
                    bookGenre: "Drama",
                    bookState: "Available"

                },
                {
                    bookName: "The Tempest",
                    bookAuthor: "William Shakespeare",
                    bookPages: 162,
                    bookPrice: 250,
                    bookPublication: "N/A",
                    bookGenre: "Drama",
                    bookState: "Available"

                },
                {
                    bookName: "Hamlet",
                    bookAuthor: "William Shakespeare",
                    bookPages: 342,
                    bookPrice: 300,
                    bookPublication: "N/A",
                    bookGenre: "Drama",
                    bookState: "Available"
                },
                {
                    bookName: "King Lear",
                    bookAuthor: "William Shakespeare",
                    bookPages: 384,
                    bookPrice: 350,
                    bookPublication: "N/A",
                    bookGenre: "Drama",
                    bookState: "Available"

                },
                {
                    bookName: "Twelfth Night",
                    bookAuthor: "William Shakespeare",
                    bookPages: 216,
                    bookPrice: 300,
                    bookPublication: "N/A",
                    bookGenre: "Drama",
                    bookState: "Available"
                },
                {
                    bookName: "Julius Caesar",
                    bookAuthor: "William Shakespeare",
                    bookPages: 200,
                    bookPrice: 250,
                    bookPublication: "N/A",
                    bookGenre: "Drama",
                    bookState: "Available"
                },
                {
                    bookName: "Much Ado About Nothing",
                    bookAuthor: "William Shakespeare",
                    bookPages: 220,
                    bookPrice: 300,
                    bookPublication: "N/A",
                    bookGenre: "Drama",
                    bookState: "Available"
                },
                {
                    bookName: "As you Like it",
                    bookAuthor: "William Shakespeare",
                    bookPages: 220,
                    bookPrice: 300,
                    bookPublication: "N/A",
                    bookGenre: "Drama",
                    bookState: "Available"

                },
                {
                    bookName: "The Rise and Fall of the Third Reich",
                    bookAuthor: "William L. Shirer",
                    bookPages: 1249,
                    bookPrice: 600,
                    bookPublication: "Simon & Schuster",
                    bookGenre: "History",
                    bookState: "Available"
                },
                {
                    bookName: "Stalingrad",
                    bookAuthor: "Antony Beevor",
                    bookPages: 493,
                    bookPrice: 450,
                    bookPublication: "Viking",
                    bookGenre: "History",
                    bookState: "Available"
                },
                {
                    bookName: "The Second World War",
                    bookAuthor: "Antony Beevor",
                    bookPages: 863,
                    bookPrice: 550,
                    bookPublication: "Weidenfeld & Nicolson",
                    bookGenre: "History",
                    bookState: "Available"
                },
                {
                    bookName: "Band of Brothers",
                    bookAuthor: "Stephen E. Ambrose",
                    bookPages: 336,
                    bookPrice: 400,
                    bookPublication: "Simon & Schuster",
                    bookGenre: "History",
                    bookState: "Available"
                },
                {
                    bookName: "D-Day: June 6, 1944",
                    bookAuthor: "Stephen E. Ambrose",
                    bookPages: 656,
                    bookPrice: 500,
                    bookPublication: "Simon & Schuster",
                    bookGenre: "History",
                    bookState: "Available"
                },
                {
                    bookName: "The Diary of a Young Girl",
                    bookAuthor: "Anne Frank",
                    bookPages: 283,
                    bookPrice: 300,
                    bookPublication: "Contact Publishing",
                    bookGenre: "Biography",
                    bookState: "Available"
                },
                {
                    bookName: "Night",
                    bookAuthor: "Elie Wiesel",
                    bookPages: 116,
                    bookPrice: 250,
                    bookPublication: "Hill & Wang",
                    bookGenre: "Biography",
                    bookState: "Available"
                },
                {
                    bookName: "Maus",
                    bookAuthor: "Art Spiegelman",
                    bookPages: 296,
                    bookPrice: 350,
                    bookPublication: "Pantheon Books",
                    bookGenre: "Graphic Novel",
                    bookState: "Available"
                },
                {
                    bookName: "All the Light We Cannot See",
                    bookAuthor: "Anthony Doerr",
                    bookPages: 531,
                    bookPrice: 450,
                    bookPublication: "Scribner",
                    bookGenre: "Historical Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "The Book Thief",
                    bookAuthor: "Markus Zusak",
                    bookPages: 552,
                    bookPrice: 400,
                    bookPublication: "Picador",
                    bookGenre: "Historical Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "Unbroken",
                    bookAuthor: "Laura Hillenbrand",
                    bookPages: 473,
                    bookPrice: 420,
                    bookPublication: "Random House",
                    bookGenre: "Biography",
                    bookState: "Available"
                },
                {
                    bookName: "Man's Search for Meaning",
                    bookAuthor: "Viktor Frankl",
                    bookPages: 165,
                    bookPrice: 280,
                    bookPublication: "Verlag für Jugend und Volk",
                    bookGenre: "Psychology",
                    bookState: "Available"
                },
                {
                    bookName: "A Bridge Too Far",
                    bookAuthor: "Cornelius Ryan",
                    bookPages: 670,
                    bookPrice: 480,
                    bookPublication: "Simon & Schuster",
                    bookGenre: "History",
                    bookState: "Available"
                },
                {
                    bookName: "The Longest Day",
                    bookAuthor: "Cornelius Ryan",
                    bookPages: 352,
                    bookPrice: 380,
                    bookPublication: "Simon & Schuster",
                    bookGenre: "History",
                    bookState: "Available"
                },
                {
                    bookName: "Churchill: A Life",
                    bookAuthor: "Martin Gilbert",
                    bookPages: 1066,
                    bookPrice: 700,
                    bookPublication: "Holt",
                    bookGenre: "Biography",
                    bookState: "Available"
                },
                {
                    bookName: "The Guns of Navarone",
                    bookAuthor: "Alistair MacLean",
                    bookPages: 320,
                    bookPrice: 350,
                    bookPublication: "Collins",
                    bookGenre: "Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "Where Eagles Dare",
                    bookAuthor: "Alistair MacLean",
                    bookPages: 320,
                    bookPrice: 350,
                    bookPublication: "Collins",
                    bookGenre: "Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "Schindler's List",
                    bookAuthor: "Thomas Keneally",
                    bookPages: 429,
                    bookPrice: 400,
                    bookPublication: "Serendip Fine Art",
                    bookGenre: "Historical Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "Empire of the Sun",
                    bookAuthor: "J.G. Ballard",
                    bookPages: 279,
                    bookPrice: 320,
                    bookPublication: "Gollancz",
                    bookGenre: "Historical Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "The Naked and the Dead",
                    bookAuthor: "Norman Mailer",
                    bookPages: 721,
                    bookPrice: 500,
                    bookPublication: "Rinehart & Company",
                    bookGenre: "Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "From Here to Eternity",
                    bookAuthor: "James Jones",
                    bookPages: 861,
                    bookPrice: 550,
                    bookPublication: "Scribner",
                    bookGenre: "Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "The Thin Red Line",
                    bookAuthor: "James Jones",
                    bookPages: 495,
                    bookPrice: 450,
                    bookPublication: "Scribner",
                    bookGenre: "Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "Hiroshima",
                    bookAuthor: "John Hersey",
                    bookPages: 152,
                    bookPrice: 250,
                    bookPublication: "Alfred A. Knopf",
                    bookGenre: "History",
                    bookState: "Available"
                },
                {
                    bookName: "The Hiding Place",
                    bookAuthor: "Corrie ten Boom",
                    bookPages: 272,
                    bookPrice: 300,
                    bookPublication: "Bantam Books",
                    bookGenre: "Biography",
                    bookState: "Available"
                },
                {
                    bookName: "The Tattooist of Auschwitz",
                    bookAuthor: "Heather Morris",
                    bookPages: 249,
                    bookPrice: 350,
                    bookPublication: "Bonnier Zaffre",
                    bookGenre: "Historical Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "The Boy in the Striped Pajamas",
                    bookAuthor: "John Boyne",
                    bookPages: 216,
                    bookPrice: 300,
                    bookPublication: "David Fickling Books",
                    bookGenre: "Historical Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "War and Remembrance",
                    bookAuthor: "Herman Wouk",
                    bookPages: 1042,
                    bookPrice: 650,
                    bookPublication: "Little, Brown",
                    bookGenre: "Historical Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "The Winds of War",
                    bookAuthor: "Herman Wouk",
                    bookPages: 885,
                    bookPrice: 600,
                    bookPublication: "Little, Brown",
                    bookGenre: "Historical Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "Das Boot",
                    bookAuthor: "Lothar-Günther Buchheim",
                    bookPages: 593,
                    bookPrice: 450,
                    bookPublication: "Piper Verlag",
                    bookGenre: "Fiction",
                    bookState: "Available"
                },
                {
                    bookName: "With the Old Breed",
                    bookAuthor: "E.B. Sledge",
                    bookPages: 326,
                    bookPrice: 380,
                    bookPublication: "Presidio Press",
                    bookGenre: "Memoir",
                    bookState: "Available"
                },
                // Marvel & DC Comics (30)
                { bookName: "Watchmen", bookAuthor: "Alan Moore", bookPages: 416, bookPrice: 400, bookPublication: "DC Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Batman: The Dark Knight Returns", bookAuthor: "Frank Miller", bookPages: 224, bookPrice: 350, bookPublication: "DC Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "The Sandman Vol. 1: Preludes & Nocturnes", bookAuthor: "Neil Gaiman", bookPages: 240, bookPrice: 300, bookPublication: "DC Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Kingdom Come", bookAuthor: "Mark Waid", bookPages: 232, bookPrice: 320, bookPublication: "DC Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Batman: Year One", bookAuthor: "Frank Miller", bookPages: 144, bookPrice: 250, bookPublication: "DC Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "All-Star Superman", bookAuthor: "Grant Morrison", bookPages: 304, bookPrice: 380, bookPublication: "DC Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "V for Vendetta", bookAuthor: "Alan Moore", bookPages: 296, bookPrice: 350, bookPublication: "DC Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Saga of the Swamp Thing", bookAuthor: "Alan Moore", bookPages: 208, bookPrice: 280, bookPublication: "DC Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Marvels", bookAuthor: "Kurt Busiek", bookPages: 248, bookPrice: 300, bookPublication: "Marvel Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Daredevil: Born Again", bookAuthor: "Frank Miller", bookPages: 176, bookPrice: 260, bookPublication: "Marvel Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Batman: The Long Halloween", bookAuthor: "Jeph Loeb", bookPages: 384, bookPrice: 400, bookPublication: "DC Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "X-Men: Days of Future Past", bookAuthor: "Chris Claremont", bookPages: 144, bookPrice: 250, bookPublication: "Marvel Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "The Killing Joke", bookAuthor: "Alan Moore", bookPages: 64, bookPrice: 200, bookPublication: "DC Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Crisis on Infinite Earths", bookAuthor: "Marv Wolfman", bookPages: 368, bookPrice: 450, bookPublication: "DC Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Civil War", bookAuthor: "Mark Millar", bookPages: 208, bookPrice: 300, bookPublication: "Marvel Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Infinity Gauntlet", bookAuthor: "Jim Starlin", bookPages: 256, bookPrice: 350, bookPublication: "Marvel Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Secret Wars", bookAuthor: "Jim Shooter", bookPages: 336, bookPrice: 380, bookPublication: "Marvel Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Spider-Man: Kraven's Last Hunt", bookAuthor: "J.M. DeMatteis", bookPages: 168, bookPrice: 250, bookPublication: "Marvel Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Green Lantern: Rebirth", bookAuthor: "Geoff Johns", bookPages: 176, bookPrice: 280, bookPublication: "DC Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Flashpoint", bookAuthor: "Geoff Johns", bookPages: 176, bookPrice: 280, bookPublication: "DC Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Superman: Red Son", bookAuthor: "Mark Millar", bookPages: 168, bookPrice: 260, bookPublication: "DC Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Old Man Logan", bookAuthor: "Mark Millar", bookPages: 232, bookPrice: 320, bookPublication: "Marvel Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "The Dark Phoenix Saga", bookAuthor: "Chris Claremont", bookPages: 200, bookPrice: 300, bookPublication: "Marvel Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Batman: Hush", bookAuthor: "Jeph Loeb", bookPages: 320, bookPrice: 380, bookPublication: "DC Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Wonder Woman: Blood", bookAuthor: "Brian Azzarello", bookPages: 160, bookPrice: 250, bookPublication: "DC Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Aquaman: The Trench", bookAuthor: "Geoff Johns", bookPages: 144, bookPrice: 240, bookPublication: "DC Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Justice League: Origin", bookAuthor: "Geoff Johns", bookPages: 192, bookPrice: 280, bookPublication: "DC Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Ms. Marvel: No Normal", bookAuthor: "G. Willow Wilson", bookPages: 120, bookPrice: 220, bookPublication: "Marvel Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "Hawkeye: My Life as a Weapon", bookAuthor: "Matt Fraction", bookPages: 136, bookPrice: 240, bookPublication: "Marvel Comics", bookGenre: "Comics", bookState: "Available" },
                { bookName: "The Vision", bookAuthor: "Tom King", bookPages: 272, bookPrice: 320, bookPublication: "Marvel Comics", bookGenre: "Comics", bookState: "Available" },

                // Science Fiction (30)
                { bookName: "Dune", bookAuthor: "Frank Herbert", bookPages: 412, bookPrice: 450, bookPublication: "Chilton Books", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "Neuromancer", bookAuthor: "William Gibson", bookPages: 271, bookPrice: 300, bookPublication: "Ace", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "Snow Crash", bookAuthor: "Neal Stephenson", bookPages: 480, bookPrice: 400, bookPublication: "Bantam Spectra", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "The Left Hand of Darkness", bookAuthor: "Ursula K. Le Guin", bookPages: 304, bookPrice: 350, bookPublication: "Ace", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "Foundation", bookAuthor: "Isaac Asimov", bookPages: 255, bookPrice: 300, bookPublication: "Gnome Press", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "Hyperion", bookAuthor: "Dan Simmons", bookPages: 482, bookPrice: 420, bookPublication: "Doubleday", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "Ender's Game", bookAuthor: "Orson Scott Card", bookPages: 324, bookPrice: 350, bookPublication: "Tor Books", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "The Hitchhiker's Guide to the Galaxy", bookAuthor: "Douglas Adams", bookPages: 224, bookPrice: 280, bookPublication: "Pan Books", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "The War of the Worlds", bookAuthor: "H.G. Wells", bookPages: 192, bookPrice: 250, bookPublication: "Heinemann", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "The Time Machine", bookAuthor: "H.G. Wells", bookPages: 118, bookPrice: 200, bookPublication: "Heinemann", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "Do Androids Dream of Electric Sheep?", bookAuthor: "Philip K. Dick", bookPages: 210, bookPrice: 300, bookPublication: "Doubleday", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "2001: A Space Odyssey", bookAuthor: "Arthur C. Clarke", bookPages: 221, bookPrice: 300, bookPublication: "Hutchinson", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "Starship Troopers", bookAuthor: "Robert A. Heinlein", bookPages: 263, bookPrice: 320, bookPublication: "Putnam", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "The Forever War", bookAuthor: "Joe Haldeman", bookPages: 236, bookPrice: 300, bookPublication: "St. Martin's Press", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "A Fire Upon the Deep", bookAuthor: "Vernor Vinge", bookPages: 391, bookPrice: 400, bookPublication: "Tor Books", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "Altered Carbon", bookAuthor: "Richard K. Morgan", bookPages: 375, bookPrice: 380, bookPublication: "Gollancz", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "The Three-Body Problem", bookAuthor: "Cixin Liu", bookPages: 302, bookPrice: 350, bookPublication: "Chongqing Press", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "Leviathan Wakes", bookAuthor: "James S.A. Corey", bookPages: 561, bookPrice: 450, bookPublication: "Orbit", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "Red Mars", bookAuthor: "Kim Stanley Robinson", bookPages: 572, bookPrice: 460, bookPublication: "Bantam Spectra", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "The Martian", bookAuthor: "Andy Weir", bookPages: 369, bookPrice: 350, bookPublication: "Crown", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "Project Hail Mary", bookAuthor: "Andy Weir", bookPages: 496, bookPrice: 400, bookPublication: "Ballantine Books", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "Childhood's End", bookAuthor: "Arthur C. Clarke", bookPages: 214, bookPrice: 300, bookPublication: "Ballantine Books", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "Ringworld", bookAuthor: "Larry Niven", bookPages: 342, bookPrice: 350, bookPublication: "Ballantine Books", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "Rendezvous with Rama", bookAuthor: "Arthur C. Clarke", bookPages: 288, bookPrice: 320, bookPublication: "Gollancz", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "I, Robot", bookAuthor: "Isaac Asimov", bookPages: 253, bookPrice: 300, bookPublication: "Gnome Press", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "The Stars My Destination", bookAuthor: "Alfred Bester", bookPages: 197, bookPrice: 280, bookPublication: "Sidgwick & Jackson", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "Solaris", bookAuthor: "Stanislaw Lem", bookPages: 204, bookPrice: 300, bookPublication: "Walker & Co", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "A Canticle for Leibowitz", bookAuthor: "Walter M. Miller Jr.", bookPages: 320, bookPrice: 350, bookPublication: "J.B. Lippincott", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "The Dispossessed", bookAuthor: "Ursula K. Le Guin", bookPages: 387, bookPrice: 380, bookPublication: "Harper & Row", bookGenre: "Science Fiction", bookState: "Available" },
                { bookName: "Stranger in a Strange Land", bookAuthor: "Robert A. Heinlein", bookPages: 408, bookPrice: 400, bookPublication: "Putnam", bookGenre: "Science Fiction", bookState: "Available" },

                // History (30)
                { bookName: "Sapiens: A Brief History of Humankind", bookAuthor: "Yuval Noah Harari", bookPages: 443, bookPrice: 500, bookPublication: "Harvill Secker", bookGenre: "History", bookState: "Available" },
                { bookName: "Guns, Germs, and Steel", bookAuthor: "Jared Diamond", bookPages: 480, bookPrice: 450, bookPublication: "W.W. Norton", bookGenre: "History", bookState: "Available" },
                { bookName: "The Silk Roads", bookAuthor: "Peter Frankopan", bookPages: 636, bookPrice: 550, bookPublication: "Bloomsbury", bookGenre: "History", bookState: "Available" },
                { bookName: "1491: New Revelations of the Americas", bookAuthor: "Charles C. Mann", bookPages: 541, bookPrice: 480, bookPublication: "Knopf", bookGenre: "History", bookState: "Available" },
                { bookName: "Genghis Khan and the Making of the Modern World", bookAuthor: "Jack Weatherford", bookPages: 352, bookPrice: 380, bookPublication: "Crown", bookGenre: "History", bookState: "Available" },
                { bookName: "The History of the Ancient World", bookAuthor: "Susan Wise Bauer", bookPages: 896, bookPrice: 600, bookPublication: "W.W. Norton", bookGenre: "History", bookState: "Available" },
                { bookName: "SPQR: A History of Ancient Rome", bookAuthor: "Mary Beard", bookPages: 606, bookPrice: 500, bookPublication: "Liveright", bookGenre: "History", bookState: "Available" },
                { bookName: "The Rise and Fall of Ancient Egypt", bookAuthor: "Toby Wilkinson", bookPages: 656, bookPrice: 520, bookPublication: "Random House", bookGenre: "History", bookState: "Available" },
                { bookName: "Rubicon", bookAuthor: "Tom Holland", bookPages: 464, bookPrice: 450, bookPublication: "Doubleday", bookGenre: "History", bookState: "Available" },
                { bookName: "Persian Fire", bookAuthor: "Tom Holland", bookPages: 448, bookPrice: 450, bookPublication: "Little, Brown", bookGenre: "History", bookState: "Available" },
                { bookName: "The Crusades", bookAuthor: "Thomas Asbridge", bookPages: 784, bookPrice: 580, bookPublication: "Simon & Schuster", bookGenre: "History", bookState: "Available" },
                { bookName: "1776", bookAuthor: "David McCullough", bookPages: 386, bookPrice: 400, bookPublication: "Simon & Schuster", bookGenre: "History", bookState: "Available" },
                { bookName: "Battle Cry of Freedom", bookAuthor: "James M. McPherson", bookPages: 904, bookPrice: 650, bookPublication: "Oxford University Press", bookGenre: "History", bookState: "Available" },
                { bookName: "The Guns of August", bookAuthor: "Barbara W. Tuchman", bookPages: 511, bookPrice: 480, bookPublication: "Macmillan", bookGenre: "History", bookState: "Available" },
                { bookName: "A World Undone", bookAuthor: "G.J. Meyer", bookPages: 670, bookPrice: 500, bookPublication: "Delacorte Press", bookGenre: "History", bookState: "Available" },
                { bookName: "The Face of Battle", bookAuthor: "John Keegan", bookPages: 352, bookPrice: 380, bookPublication: "Jonathan Cape", bookGenre: "History", bookState: "Available" },
                { bookName: "Postwar", bookAuthor: "Tony Judt", bookPages: 878, bookPrice: 600, bookPublication: "Penguin Press", bookGenre: "History", bookState: "Available" },
                { bookName: "Iron Curtain", bookAuthor: "Anne Applebaum", bookPages: 566, bookPrice: 500, bookPublication: "Doubleday", bookGenre: "History", bookState: "Available" },
                { bookName: "Gulag: A History", bookAuthor: "Anne Applebaum", bookPages: 677, bookPrice: 550, bookPublication: "Doubleday", bookGenre: "History", bookState: "Available" },
                { bookName: "India After Gandhi", bookAuthor: "Ramachandra Guha", bookPages: 900, bookPrice: 600, bookPublication: "Ecco", bookGenre: "History", bookState: "Available" },
                { bookName: "The Anarchy", bookAuthor: "William Dalrymple", bookPages: 576, bookPrice: 500, bookPublication: "Bloomsbury", bookGenre: "History", bookState: "Available" },
                { bookName: "King Leopold's Ghost", bookAuthor: "Adam Hochschild", bookPages: 366, bookPrice: 400, bookPublication: "Houghton Mifflin", bookGenre: "History", bookState: "Available" },
                { bookName: "Bury My Heart at Wounded Knee", bookAuthor: "Dee Brown", bookPages: 487, bookPrice: 450, bookPublication: "Holt, Rinehart & Winston", bookGenre: "History", bookState: "Available" },
                { bookName: "A People's History of the United States", bookAuthor: "Howard Zinn", bookPages: 729, bookPrice: 500, bookPublication: "Harper & Row", bookGenre: "History", bookState: "Available" },
                { bookName: "The Devil in the White City", bookAuthor: "Erik Larson", bookPages: 447, bookPrice: 420, bookPublication: "Crown", bookGenre: "History", bookState: "Available" },
                { bookName: "Dead Wake", bookAuthor: "Erik Larson", bookPages: 430, bookPrice: 420, bookPublication: "Crown", bookGenre: "History", bookState: "Available" },
                { bookName: "The Splendid and the Vile", bookAuthor: "Erik Larson", bookPages: 608, bookPrice: 500, bookPublication: "Crown", bookGenre: "History", bookState: "Available" },
                { bookName: "Say Nothing", bookAuthor: "Patrick Radden Keefe", bookPages: 441, bookPrice: 450, bookPublication: "Doubleday", bookGenre: "History", bookState: "Available" },
                { bookName: "Killers of the Flower Moon", bookAuthor: "David Grann", bookPages: 338, bookPrice: 400, bookPublication: "Doubleday", bookGenre: "History", bookState: "Available" },
                { bookName: "The Wager", bookAuthor: "David Grann", bookPages: 352, bookPrice: 400, bookPublication: "Doubleday", bookGenre: "History", bookState: "Available" },

                // Maths, Physics, Chemistry (100)
                // Mathematics (34)
                { bookName: "Calculus", bookAuthor: "James Stewart", bookPages: 1300, bookPrice: 800, bookPublication: "Cengage Learning", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Linear Algebra Done Right", bookAuthor: "Sheldon Axler", bookPages: 340, bookPrice: 400, bookPublication: "Springer", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Introduction to Algorithms", bookAuthor: "Thomas H. Cormen", bookPages: 1312, bookPrice: 850, bookPublication: "MIT Press", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "The Joy of x", bookAuthor: "Steven Strogatz", bookPages: 336, bookPrice: 350, bookPublication: "Houghton Mifflin Harcourt", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Humble Pi", bookAuthor: "Matt Parker", bookPages: 336, bookPrice: 320, bookPublication: "Riverhead Books", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Fermat's Last Theorem", bookAuthor: "Simon Singh", bookPages: 368, bookPrice: 380, bookPublication: "Fourth Estate", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "The Code Book", bookAuthor: "Simon Singh", bookPages: 432, bookPrice: 400, bookPublication: "Fourth Estate", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Prime Obsession", bookAuthor: "John Derbyshire", bookPages: 448, bookPrice: 420, bookPublication: "Joseph Henry Press", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Gödel, Escher, Bach", bookAuthor: "Douglas Hofstadter", bookPages: 777, bookPrice: 600, bookPublication: "Basic Books", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "A Mathematician's Apology", bookAuthor: "G.H. Hardy", bookPages: 153, bookPrice: 200, bookPublication: "Cambridge University Press", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "What is Mathematics?", bookAuthor: "Richard Courant", bookPages: 592, bookPrice: 450, bookPublication: "Oxford University Press", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "The Man Who Knew Infinity", bookAuthor: "Robert Kanigel", bookPages: 438, bookPrice: 400, bookPublication: "Washington Square Press", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Infinite Powers", bookAuthor: "Steven Strogatz", bookPages: 384, bookPrice: 380, bookPublication: "Houghton Mifflin Harcourt", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "How Not to Be Wrong", bookAuthor: "Jordan Ellenberg", bookPages: 480, bookPrice: 420, bookPublication: "Penguin Press", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Weapons of Math Destruction", bookAuthor: "Cathy O'Neil", bookPages: 272, bookPrice: 300, bookPublication: "Crown", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Flatland", bookAuthor: "Edwin A. Abbott", bookPages: 96, bookPrice: 150, bookPublication: "Seeley & Co.", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Euclid's Elements", bookAuthor: "Euclid", bookPages: 500, bookPrice: 400, bookPublication: "Green Lion Press", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "The Princeton Companion to Mathematics", bookAuthor: "Timothy Gowers", bookPages: 1056, bookPrice: 900, bookPublication: "Princeton University Press", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Concrete Mathematics", bookAuthor: "Donald Knuth", bookPages: 672, bookPrice: 600, bookPublication: "Addison-Wesley", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Topology", bookAuthor: "James Munkres", bookPages: 537, bookPrice: 500, bookPublication: "Pearson", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Abstract Algebra", bookAuthor: "David Dummit", bookPages: 944, bookPrice: 700, bookPublication: "Wiley", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Real Analysis", bookAuthor: "H.L. Royden", bookPages: 544, bookPrice: 550, bookPublication: "Pearson", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Complex Analysis", bookAuthor: "Lars Ahlfors", bookPages: 336, bookPrice: 450, bookPublication: "McGraw-Hill", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Probability Theory", bookAuthor: "E.T. Jaynes", bookPages: 758, bookPrice: 650, bookPublication: "Cambridge University Press", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Statistics", bookAuthor: "David Freedman", bookPages: 720, bookPrice: 600, bookPublication: "W.W. Norton", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "The Art of Statistics", bookAuthor: "David Spiegelhalter", bookPages: 448, bookPrice: 400, bookPublication: "Basic Books", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Naked Statistics", bookAuthor: "Charles Wheelan", bookPages: 320, bookPrice: 350, bookPublication: "W.W. Norton", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Zero: The Biography of a Dangerous Idea", bookAuthor: "Charles Seife", bookPages: 256, bookPrice: 300, bookPublication: "Viking", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "e: The Story of a Number", bookAuthor: "Eli Maor", bookPages: 248, bookPrice: 300, bookPublication: "Princeton University Press", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "The Music of the Primes", bookAuthor: "Marcus du Sautoy", bookPages: 352, bookPrice: 350, bookPublication: "HarperCollins", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Sync", bookAuthor: "Steven Strogatz", bookPages: 352, bookPrice: 350, bookPublication: "Hyperion", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Chaos", bookAuthor: "James Gleick", bookPages: 368, bookPrice: 380, bookPublication: "Viking", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "Does God Play Dice?", bookAuthor: "Ian Stewart", bookPages: 416, bookPrice: 400, bookPublication: "Blackwell", bookGenre: "Mathematics", bookState: "Available" },
                { bookName: "The Signal and the Noise", bookAuthor: "Nate Silver", bookPages: 544, bookPrice: 450, bookPublication: "Penguin Press", bookGenre: "Mathematics", bookState: "Available" },

                // Physics (33)
                { bookName: "A Brief History of Time", bookAuthor: "Stephen Hawking", bookPages: 256, bookPrice: 300, bookPublication: "Bantam Books", bookGenre: "Physics", bookState: "Available" },
                { bookName: "The Universe in a Nutshell", bookAuthor: "Stephen Hawking", bookPages: 224, bookPrice: 350, bookPublication: "Bantam Books", bookGenre: "Physics", bookState: "Available" },
                { bookName: "The Feynman Lectures on Physics", bookAuthor: "Richard Feynman", bookPages: 1552, bookPrice: 1200, bookPublication: "Addison-Wesley", bookGenre: "Physics", bookState: "Available" },
                { bookName: "Six Easy Pieces", bookAuthor: "Richard Feynman", bookPages: 176, bookPrice: 250, bookPublication: "Basic Books", bookGenre: "Physics", bookState: "Available" },
                { bookName: "QED", bookAuthor: "Richard Feynman", bookPages: 172, bookPrice: 250, bookPublication: "Princeton University Press", bookGenre: "Physics", bookState: "Available" },
                { bookName: "Surely You're Joking, Mr. Feynman!", bookAuthor: "Richard Feynman", bookPages: 350, bookPrice: 350, bookPublication: "W.W. Norton", bookGenre: "Physics", bookState: "Available" },
                { bookName: "The Elegant Universe", bookAuthor: "Brian Greene", bookPages: 464, bookPrice: 400, bookPublication: "W.W. Norton", bookGenre: "Physics", bookState: "Available" },
                { bookName: "The Fabric of the Cosmos", bookAuthor: "Brian Greene", bookPages: 592, bookPrice: 450, bookPublication: "Knopf", bookGenre: "Physics", bookState: "Available" },
                { bookName: "Reality Is Not What It Seems", bookAuthor: "Carlo Rovelli", bookPages: 288, bookPrice: 300, bookPublication: "Riverhead Books", bookGenre: "Physics", bookState: "Available" },
                { bookName: "Seven Brief Lessons on Physics", bookAuthor: "Carlo Rovelli", bookPages: 96, bookPrice: 200, bookPublication: "Riverhead Books", bookGenre: "Physics", bookState: "Available" },
                { bookName: "The Order of Time", bookAuthor: "Carlo Rovelli", bookPages: 256, bookPrice: 300, bookPublication: "Riverhead Books", bookGenre: "Physics", bookState: "Available" },
                { bookName: "Astrophysics for People in a Hurry", bookAuthor: "Neil deGrasse Tyson", bookPages: 224, bookPrice: 280, bookPublication: "W.W. Norton", bookGenre: "Physics", bookState: "Available" },
                { bookName: "Cosmos", bookAuthor: "Carl Sagan", bookPages: 365, bookPrice: 400, bookPublication: "Random House", bookGenre: "Physics", bookState: "Available" },
                { bookName: "Pale Blue Dot", bookAuthor: "Carl Sagan", bookPages: 429, bookPrice: 420, bookPublication: "Random House", bookGenre: "Physics", bookState: "Available" },
                { bookName: "The Demon-Haunted World", bookAuthor: "Carl Sagan", bookPages: 457, bookPrice: 400, bookPublication: "Random House", bookGenre: "Physics", bookState: "Available" },
                { bookName: "Parallel Worlds", bookAuthor: "Michio Kaku", bookPages: 448, bookPrice: 400, bookPublication: "Doubleday", bookGenre: "Physics", bookState: "Available" },
                { bookName: "Physics of the Impossible", bookAuthor: "Michio Kaku", bookPages: 352, bookPrice: 350, bookPublication: "Doubleday", bookGenre: "Physics", bookState: "Available" },
                { bookName: "Hyperspace", bookAuthor: "Michio Kaku", bookPages: 384, bookPrice: 380, bookPublication: "Oxford University Press", bookGenre: "Physics", bookState: "Available" },
                { bookName: "The Grand Design", bookAuthor: "Stephen Hawking", bookPages: 208, bookPrice: 300, bookPublication: "Bantam Books", bookGenre: "Physics", bookState: "Available" },
                { bookName: "Black Holes and Time Warps", bookAuthor: "Kip Thorne", bookPages: 619, bookPrice: 500, bookPublication: "W.W. Norton", bookGenre: "Physics", bookState: "Available" },
                { bookName: "The First Three Minutes", bookAuthor: "Steven Weinberg", bookPages: 224, bookPrice: 300, bookPublication: "Basic Books", bookGenre: "Physics", bookState: "Available" },
                { bookName: "Dreams of a Final Theory", bookAuthor: "Steven Weinberg", bookPages: 352, bookPrice: 350, bookPublication: "Pantheon", bookGenre: "Physics", bookState: "Available" },
                { bookName: "The Road to Reality", bookAuthor: "Roger Penrose", bookPages: 1136, bookPrice: 800, bookPublication: "Knopf", bookGenre: "Physics", bookState: "Available" },
                { bookName: "Concepts of Modern Physics", bookAuthor: "Arthur Beiser", bookPages: 600, bookPrice: 500, bookPublication: "McGraw-Hill", bookGenre: "Physics", bookState: "Available" },
                { bookName: "Introduction to Electrodynamics", bookAuthor: "David J. Griffiths", bookPages: 624, bookPrice: 600, bookPublication: "Pearson", bookGenre: "Physics", bookState: "Available" },
                { bookName: "Introduction to Quantum Mechanics", bookAuthor: "David J. Griffiths", bookPages: 496, bookPrice: 550, bookPublication: "Pearson", bookGenre: "Physics", bookState: "Available" },
                { bookName: "Classical Mechanics", bookAuthor: "John R. Taylor", bookPages: 800, bookPrice: 650, bookPublication: "University Science Books", bookGenre: "Physics", bookState: "Available" },
                { bookName: "Thermal Physics", bookAuthor: "Charles Kittel", bookPages: 496, bookPrice: 500, bookPublication: "Wiley", bookGenre: "Physics", bookState: "Available" },
                { bookName: "Solid State Physics", bookAuthor: "Neil Ashcroft", bookPages: 848, bookPrice: 700, bookPublication: "Cengage Learning", bookGenre: "Physics", bookState: "Available" },
                { bookName: "Optics", bookAuthor: "Eugene Hecht", bookPages: 720, bookPrice: 600, bookPublication: "Pearson", bookGenre: "Physics", bookState: "Available" },
                { bookName: "University Physics", bookAuthor: "Young and Freedman", bookPages: 1600, bookPrice: 900, bookPublication: "Pearson", bookGenre: "Physics", bookState: "Available" },
                { bookName: "Fundamentals of Physics", bookAuthor: "Halliday & Resnick", bookPages: 1456, bookPrice: 850, bookPublication: "Wiley", bookGenre: "Physics", bookState: "Available" },
                { bookName: "The Particle at the End of the Universe", bookAuthor: "Sean Carroll", bookPages: 352, bookPrice: 350, bookPublication: "Dutton", bookGenre: "Physics", bookState: "Available" },

                // Chemistry (33)
                { bookName: "The Disappearing Spoon", bookAuthor: "Sam Kean", bookPages: 400, bookPrice: 350, bookPublication: "Little, Brown", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Napoleon's Buttons", bookAuthor: "Penny Le Couteur", bookPages: 384, bookPrice: 350, bookPublication: "TarcherPerigee", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "The Periodic Table", bookAuthor: "Primo Levi", bookPages: 233, bookPrice: 300, bookPublication: "Schocken", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Uncle Tungsten", bookAuthor: "Oliver Sacks", bookPages: 352, bookPrice: 350, bookPublication: "Knopf", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Molecules", bookAuthor: "Theodore Gray", bookPages: 240, bookPrice: 400, bookPublication: "Black Dog & Leventhal", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "The Elements", bookAuthor: "Theodore Gray", bookPages: 240, bookPrice: 400, bookPublication: "Black Dog & Leventhal", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Reactions", bookAuthor: "Theodore Gray", bookPages: 224, bookPrice: 400, bookPublication: "Black Dog & Leventhal", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Stuff Matters", bookAuthor: "Mark Miodownik", bookPages: 272, bookPrice: 300, bookPublication: "Houghton Mifflin Harcourt", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Liquid Rules", bookAuthor: "Mark Miodownik", bookPages: 256, bookPrice: 300, bookPublication: "Houghton Mifflin Harcourt", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Ignition!", bookAuthor: "John D. Clark", bookPages: 224, bookPrice: 350, bookPublication: "Rutgers University Press", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "General Chemistry", bookAuthor: "Linus Pauling", bookPages: 992, bookPrice: 600, bookPublication: "Dover", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Organic Chemistry", bookAuthor: "Paula Yurkanis Bruice", bookPages: 1344, bookPrice: 800, bookPublication: "Pearson", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Physical Chemistry", bookAuthor: "Peter Atkins", bookPages: 1024, bookPrice: 750, bookPublication: "Oxford University Press", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Inorganic Chemistry", bookAuthor: "Gary L. Miessler", bookPages: 720, bookPrice: 650, bookPublication: "Pearson", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Biochemistry", bookAuthor: "Jeremy M. Berg", bookPages: 1120, bookPrice: 800, bookPublication: "W.H. Freeman", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Molecular Biology of the Cell", bookAuthor: "Bruce Alberts", bookPages: 1464, bookPrice: 900, bookPublication: "Garland Science", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "The Poisoner's Handbook", bookAuthor: "Deborah Blum", bookPages: 336, bookPrice: 350, bookPublication: "Penguin Books", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Periodic Tales", bookAuthor: "Hugh Aldersey-Williams", bookPages: 448, bookPrice: 400, bookPublication: "Ecco", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Elemental", bookAuthor: "Tim James", bookPages: 224, bookPrice: 300, bookPublication: "Abrams Press", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Caesar's Last Breath", bookAuthor: "Sam Kean", bookPages: 384, bookPrice: 380, bookPublication: "Little, Brown", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "The Alchemy of Air", bookAuthor: "Thomas Hager", bookPages: 336, bookPrice: 350, bookPublication: "Crown", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Mauve", bookAuthor: "Simon Garfield", bookPages: 224, bookPrice: 300, bookPublication: "W.W. Norton", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "The 13th Element", bookAuthor: "John Emsley", bookPages: 336, bookPrice: 350, bookPublication: "Wiley", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Nature's Building Blocks", bookAuthor: "John Emsley", bookPages: 720, bookPrice: 500, bookPublication: "Oxford University Press", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Molecules of Murder", bookAuthor: "John Emsley", bookPages: 252, bookPrice: 320, bookPublication: "Royal Society of Chemistry", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "That's the Way the Cookie Crumbles", bookAuthor: "Joe Schwarcz", bookPages: 272, bookPrice: 300, bookPublication: "ECW Press", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "The Genie in the Bottle", bookAuthor: "Joe Schwarcz", bookPages: 312, bookPrice: 320, bookPublication: "ECW Press", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Radar, Hula Hoops, and Playful Pigs", bookAuthor: "Joe Schwarcz", bookPages: 280, bookPrice: 300, bookPublication: "ECW Press", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "A Short History of Chemistry", bookAuthor: "Isaac Asimov", bookPages: 288, bookPrice: 300, bookPublication: "Greenwood", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Chemistry: The Central Science", bookAuthor: "Theodore L. Brown", bookPages: 1248, bookPrice: 800, bookPublication: "Pearson", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "The Sceptical Chymist", bookAuthor: "Robert Boyle", bookPages: 200, bookPrice: 300, bookPublication: "Dover", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "Silent Spring", bookAuthor: "Rachel Carson", bookPages: 378, bookPrice: 350, bookPublication: "Houghton Mifflin", bookGenre: "Chemistry", bookState: "Available" },
                { bookName: "The Double Helix", bookAuthor: "James D. Watson", bookPages: 256, bookPrice: 300, bookPublication: "Atheneum", bookGenre: "Chemistry", bookState: "Available" },

                // Artificial Intelligence (20)
                { bookName: "Superintelligence", bookAuthor: "Nick Bostrom", bookPages: 352, bookPrice: 350, bookPublication: "Oxford University Press", bookGenre: "Artificial Intelligence", bookState: "Available" },
                { bookName: "Life 3.0", bookAuthor: "Max Tegmark", bookPages: 384, bookPrice: 350, bookPublication: "Knopf", bookGenre: "Artificial Intelligence", bookState: "Available" },
                { bookName: "Human Compatible", bookAuthor: "Stuart Russell", bookPages: 352, bookPrice: 350, bookPublication: "Viking", bookGenre: "Artificial Intelligence", bookState: "Available" },
                { bookName: "AI Superpowers", bookAuthor: "Kai-Fu Lee", bookPages: 272, bookPrice: 300, bookPublication: "Houghton Mifflin Harcourt", bookGenre: "Artificial Intelligence", bookState: "Available" },
                { bookName: "The Age of AI", bookAuthor: "Henry Kissinger", bookPages: 272, bookPrice: 320, bookPublication: "Little, Brown", bookGenre: "Artificial Intelligence", bookState: "Available" },
                { bookName: "Scary Smart", bookAuthor: "Mo Gawdat", bookPages: 336, bookPrice: 320, bookPublication: "Bluebird", bookGenre: "Artificial Intelligence", bookState: "Available" },
                { bookName: "The Alignment Problem", bookAuthor: "Brian Christian", bookPages: 496, bookPrice: 400, bookPublication: "W.W. Norton", bookGenre: "Artificial Intelligence", bookState: "Available" },
                { bookName: "Atlas of AI", bookAuthor: "Kate Crawford", bookPages: 336, bookPrice: 350, bookPublication: "Yale University Press", bookGenre: "Artificial Intelligence", bookState: "Available" },
                { bookName: "Rebooting AI", bookAuthor: "Gary Marcus", bookPages: 288, bookPrice: 300, bookPublication: "Pantheon", bookGenre: "Artificial Intelligence", bookState: "Available" },
                { bookName: "T-Minus AI", bookAuthor: "Michael Kanaan", bookPages: 304, bookPrice: 320, bookPublication: "BenBella Books", bookGenre: "Artificial Intelligence", bookState: "Available" },
                { bookName: "Genius Makers", bookAuthor: "Cade Metz", bookPages: 384, bookPrice: 350, bookPublication: "Dutton", bookGenre: "Artificial Intelligence", bookState: "Available" },
                { bookName: "A World Without Work", bookAuthor: "Daniel Susskind", bookPages: 320, bookPrice: 320, bookPublication: "Metropolitan Books", bookGenre: "Artificial Intelligence", bookState: "Available" },
                { bookName: "The Singularity Is Near", bookAuthor: "Ray Kurzweil", bookPages: 672, bookPrice: 500, bookPublication: "Viking", bookGenre: "Artificial Intelligence", bookState: "Available" },
                { bookName: "How to Create a Mind", bookAuthor: "Ray Kurzweil", bookPages: 352, bookPrice: 350, bookPublication: "Viking", bookGenre: "Artificial Intelligence", bookState: "Available" },
                { bookName: "AI 2041", bookAuthor: "Kai-Fu Lee", bookPages: 480, bookPrice: 400, bookPublication: "Currency", bookGenre: "Artificial Intelligence", bookState: "Available" },
                { bookName: "You Look Like a Thing and I Love You", bookAuthor: "Janelle Shane", bookPages: 272, bookPrice: 300, bookPublication: "Voracious", bookGenre: "Artificial Intelligence", bookState: "Available" },
                { bookName: "Girl Decoded", bookAuthor: "Rana el Kaliouby", bookPages: 352, bookPrice: 350, bookPublication: "Currency", bookGenre: "Artificial Intelligence", bookState: "Available" },
                { bookName: "The Big Nine", bookAuthor: "Amy Webb", bookPages: 336, bookPrice: 320, bookPublication: "PublicAffairs", bookGenre: "Artificial Intelligence", bookState: "Available" },
                { bookName: "Army of None", bookAuthor: "Paul Scharre", bookPages: 448, bookPrice: 400, bookPublication: "W.W. Norton", bookGenre: "Artificial Intelligence", bookState: "Available" },
                { bookName: "Hello World", bookAuthor: "Hannah Fry", bookPages: 256, bookPrice: 300, bookPublication: "W.W. Norton", bookGenre: "Artificial Intelligence", bookState: "Available" },

                // Politics (22)
                { bookName: "The Prince", bookAuthor: "Niccolò Machiavelli", bookPages: 140, bookPrice: 200, bookPublication: "Antonio Blado d'Asola", bookGenre: "Politics", bookState: "Available" },
                { bookName: "Leviathan", bookAuthor: "Thomas Hobbes", bookPages: 736, bookPrice: 450, bookPublication: "Andrew Crooke", bookGenre: "Politics", bookState: "Available" },
                { bookName: "The Republic", bookAuthor: "Plato", bookPages: 416, bookPrice: 350, bookPublication: "Penguin Classics", bookGenre: "Politics", bookState: "Available" },
                { bookName: "The Communist Manifesto", bookAuthor: "Karl Marx & Friedrich Engels", bookPages: 80, bookPrice: 150, bookPublication: "Workers' Educational Association", bookGenre: "Politics", bookState: "Available" },
                { bookName: "On Liberty", bookAuthor: "John Stuart Mill", bookPages: 168, bookPrice: 250, bookPublication: "Parker and Son", bookGenre: "Politics", bookState: "Available" },
                { bookName: "Democracy in America", bookAuthor: "Alexis de Tocqueville", bookPages: 928, bookPrice: 600, bookPublication: "Saunders and Otley", bookGenre: "Politics", bookState: "Available" },
                { bookName: "The Federalist Papers", bookAuthor: "Alexander Hamilton", bookPages: 688, bookPrice: 500, bookPublication: "McLean", bookGenre: "Politics", bookState: "Available" },
                { bookName: "The Road to Serfdom", bookAuthor: "F.A. Hayek", bookPages: 266, bookPrice: 350, bookPublication: "Routledge", bookGenre: "Politics", bookState: "Available" },
                { bookName: "The Origins of Totalitarianism", bookAuthor: "Hannah Arendt", bookPages: 704, bookPrice: 550, bookPublication: "Schocken Books", bookGenre: "Politics", bookState: "Available" },
                { bookName: "Man, the State, and War", bookAuthor: "Kenneth Waltz", bookPages: 263, bookPrice: 300, bookPublication: "Columbia University Press", bookGenre: "Politics", bookState: "Available" },
                { bookName: "The Clash of Civilizations", bookAuthor: "Samuel P. Huntington", bookPages: 368, bookPrice: 400, bookPublication: "Simon & Schuster", bookGenre: "Politics", bookState: "Available" },
                { bookName: "The End of History and the Last Man", bookAuthor: "Francis Fukuyama", bookPages: 418, bookPrice: 420, bookPublication: "Free Press", bookGenre: "Politics", bookState: "Available" },
                { bookName: "Diplomacy", bookAuthor: "Henry Kissinger", bookPages: 912, bookPrice: 650, bookPublication: "Simon & Schuster", bookGenre: "Politics", bookState: "Available" },
                { bookName: "World Order", bookAuthor: "Henry Kissinger", bookPages: 432, bookPrice: 450, bookPublication: "Penguin Press", bookGenre: "Politics", bookState: "Available" },
                { bookName: "The Dictator's Handbook", bookAuthor: "Bruce Bueno de Mesquita", bookPages: 352, bookPrice: 380, bookPublication: "PublicAffairs", bookGenre: "Politics", bookState: "Available" },
                { bookName: "Why Nations Fail", bookAuthor: "Daron Acemoglu", bookPages: 544, bookPrice: 500, bookPublication: "Crown Business", bookGenre: "Politics", bookState: "Available" },
                { bookName: "Team of Rivals", bookAuthor: "Doris Kearns Goodwin", bookPages: 944, bookPrice: 600, bookPublication: "Simon & Schuster", bookGenre: "Politics", bookState: "Available" },
                { bookName: "The Audacity of Hope", bookAuthor: "Barack Obama", bookPages: 375, bookPrice: 400, bookPublication: "Crown", bookGenre: "Politics", bookState: "Available" },
                { bookName: "Decision Points", bookAuthor: "George W. Bush", bookPages: 497, bookPrice: 450, bookPublication: "Crown", bookGenre: "Politics", bookState: "Available" },
                { bookName: "Hard Choices", bookAuthor: "Hillary Clinton", bookPages: 635, bookPrice: 500, bookPublication: "Simon & Schuster", bookGenre: "Politics", bookState: "Available" },
                { bookName: "A Promised Land", bookAuthor: "Barack Obama", bookPages: 768, bookPrice: 600, bookPublication: "Crown", bookGenre: "Politics", bookState: "Available" },
                { bookName: "Fire and Fury", bookAuthor: "Michael Wolff", bookPages: 336, bookPrice: 350, bookPublication: "Henry Holt", bookGenre: "Politics", bookState: "Available" }
            ];
        
        if (count === 0) {
            await Book.insertMany(initialBooks);
            console.log("Database seeded with initial books");
        }

        // Start Server only after DB connection is established
        app.listen(PORT, () => {
            console.log(`App is running on port :${PORT}`);
        });
    })
    .catch(err => console.error("Could not connect to MongoDB", err));

// Middleware
app.set('view engine', 'ejs');
app.use(express.static("public"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Default Page (Main1)
app.get("/", (req, res) => {
    res.render("main1");
});

// Library History Page
app.get("/libhistory", (req, res) => {
    res.render("libhistory");
});

// Login Page
app.get("/login", (req, res) => {
    res.render("main", { error: null });
});

// Landing Page (Home)
app.get("/landing", (req, res) => {
    res.render("landing");
});

// Login Logic with Lockout
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    
    if (maintenanceMode && username !== "lib0.0") {
        return res.render("main", { error: "System is in Maintenance Mode. Please try again later." });
    }

    try {
        const user = await User.findOne({ username });
        
        // Maintenance Mode: Only allow Librarian role to proceed
        if (maintenanceMode) {
            if (!user || user.role !== "Librarian") {
                return res.render("main", { error: "System is in Maintenance Mode. Only Librarian can login." });
            }
        }

        if (!user || user.isDeleted) {
            return res.render("main", { error: "Invalid username or password" });
        }

        // Check if user is locked
        if (user.lockUntil && user.lockUntil > Date.now()) {
            return res.render("blocked");
        }

        // If lock has expired, reset attempts so user gets fresh tries
        if (user.lockUntil && user.lockUntil < Date.now()) {
            user.lockUntil = null;
            user.failedLoginAttempts = 0;
            await user.save();
        }

        // Compare hashed password
        const isMatch = await bcrypt.compare(password, user.password);
        if (isMatch) {
            // Reset lock if successful
            user.lockUntil = null;
            user.failedLoginAttempts = 0;
            await user.save();
            res.redirect("/landing");
        } else {
            // Wrong password
            user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
            user.totalFailedAttempts = (user.totalFailedAttempts || 0) + 1;

            if (user.failedLoginAttempts >= 10) {
                user.lockUntil = Date.now() + 60000; // 1 minute from now
                user.failedLoginAttempts = 0;
                await user.save();
                return res.render("blocked");
            }

            await user.save();
            res.render("main", { error: "Invalid username or password" });
        }
    } catch (err) {
        console.log(err);
        let errorMsg = err.message;
        if (err.message.includes("ECONNREFUSED")) {
            errorMsg = "Database connection failed. Is MongoDB running?";
        }
        res.render("main", { error: errorMsg });
    }
});

// Register Page
app.get("/register", (req, res) => {
    res.render("register", { error: null });
});

// Register Logic
app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            if (existingUser.isDeleted) {
                existingUser.originalUsername = existingUser.username;
                existingUser.username = `${existingUser.username}_deleted_${Date.now()}`;
                await existingUser.save();
            } else {
                return res.render("register", { error: "Username already exists" });
            }
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword });
        await newUser.save();
        res.redirect("/");
    } catch (err) {
        console.log(err);
        let errorMsg = err.message;
        if (err.message.includes("ECONNREFUSED")) {
            errorMsg = "Database connection failed. Is MongoDB running?";
        }
        res.render("register", { error: errorMsg });
    }
});

// Staff Registration Page
app.get("/create-staff", (req, res) => {
    res.render("staff-register", { error: null, success: null });
});

// Staff Registration Logic
app.post("/create-staff", async (req, res) => {
    const { username, password, role } = req.body;
    try {
        // Check if username exists (and handle legacy deleted users)
        const nameCheck = await User.findOne({ username });
        if (nameCheck) {
            if (nameCheck.isDeleted) {
                nameCheck.originalUsername = nameCheck.username;
                nameCheck.username = `${nameCheck.username}_deleted_${Date.now()}`;
                await nameCheck.save();
            } else {
                return res.render("staff-register", { error: "Username already taken", success: null });
            }
        }

        if (role === "Librarian") {
            if (username !== "lib0.0") {
                return res.render("staff-register", { error: "Librarian username must be 'lib0.0'", success: null });
            }
            const existingLib = await User.findOne({ role: "Librarian", isDeleted: { $ne: true } });
            if (existingLib) {
                return res.render("staff-register", { error: "A Librarian account already exists (Max 1)", success: null });
            }
        } else if (role === "Assistant") {
            // Validate format as1, as2 ... as10
            const match = username.match(/^as([1-9]|10)$/);
            if (!match) {
                return res.render("staff-register", { error: "Assistant username must be 'as1' to 'as10'", success: null });
            }
            
            const count = await User.countDocuments({ role: "Assistant", isDeleted: { $ne: true } });
            if (count >= 10) {
                return res.render("staff-register", { error: "Maximum 10 Assistants allowed", success: null });
            }
        } else {
            return res.render("staff-register", { error: "Invalid Role", success: null });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword, role });
        await newUser.save();
        res.render("staff-register", { error: null, success: `${role} account created successfully!` });

    } catch (err) {
        console.log(err);
        res.render("staff-register", { error: "Error creating account", success: null });
    }
});

// Forgot Password Page
app.get("/forgot-password", (req, res) => {
    res.render("forgot", { error: null, success: null });
});

// Forgot Password Logic
app.post("/forgot-password", async (req, res) => {
    const { username, newPassword } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.render("forgot", { error: "User not found", success: null });
        }
        user.password = newPassword;
        user.lockUntil = null; // Unlock account if it was locked
        user.failedLoginAttempts = 0;
        await user.save();
        res.render("forgot", { error: null, success: "Password reset successfully! You can now login." });
    } catch (err) {
        console.log(err);
        let errorMsg = err.message;
        if (err.message.includes("ECONNREFUSED")) {
            errorMsg = "Database connection failed. Is MongoDB running?";
        }
        res.render("forgot", { error: errorMsg, success: null });
    }
});

// Change Password Page
app.get("/change-password", (req, res) => {
    res.render("change-password", { error: null, success: null });
});

// Change Password Logic
app.post("/change-password", async (req, res) => {
    const { username, oldPassword, newPassword } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) {
            return res.render("change-password", { error: "User not found", success: null });
        }
        
        if (user.password !== oldPassword) {
             return res.render("change-password", { error: "Incorrect old password", success: null });
        }

        user.password = newPassword;
        await user.save();
        res.render("change-password", { error: null, success: "Password changed successfully!" });
    } catch (err) {
        console.log(err);
        let errorMsg = err.message;
        if (err.message.includes("ECONNREFUSED")) {
            errorMsg = "Database connection failed. Is MongoDB running?";
        }
        res.render("change-password", { error: errorMsg, success: null });
    }
});

// Profile Page
app.get("/profile", (req, res) => {
    res.render("profile", { user: null, error: null, success: null });
});

// Profile Details Logic
app.post("/profile", async (req, res) => {
    const { username } = req.body;
    try {
        const user = await User.findOne({ username, isDeleted: { $ne: true } });
        if (!user) {
            return res.render("profile", { user: null, error: "User not found", success: null });
        }
        res.render("profile", { user: user, error: null, success: null });
    } catch (err) {
        console.log(err);
        res.render("profile", { user: null, error: "Error fetching profile", success: null });
    }
});

// Delete User Route
app.post("/delete-user", async (req, res) => {
    const { username } = req.body;
    try {
        await User.updateOne({ username }, { $set: { 
            isDeleted: true,
            originalUsername: username,
            username: `${username}_deleted_${Date.now()}`
        }});
        res.render("profile", { user: null, error: null, success: "User account deleted. History preserved." });
    } catch (err) {
        console.log(err);
        res.render("profile", { user: null, error: "Error deleting user", success: null });
    }
});

// History Page
app.get("/history", (req, res) => {
    res.render("history", { resultType: null, data: null, error: null, message: req.query.message || null });
});

// History Details Logic
app.post("/history", async (req, res) => {
    const { username, borrowerName } = req.body;
    try {
        // Case 1: Search by Staff Username
        if (username) {
            let user = await User.findOne({ username });
            if (!user) {
                user = await User.findOne({ originalUsername: username });
            }

            if (!user) {
                return res.render("history", { resultType: null, data: null, error: "Staff User not found" });
            }

            // Combine Issued (Active) and Returned history
            const issued = user.issuedBooks.map(b => ({
                ...b.toObject(),
                status: 'Issued',
                date: b.issueDate,
                fine: 0
            }));
            const returned = user.returnHistory.map(b => ({
                ...b.toObject(),
                status: 'Returned',
                date: b.returnDate,
            }));

            // Sort by date descending
            const combinedHistory = [...issued, ...returned].sort((a, b) => new Date(b.date) - new Date(a.date));

            return res.render("history", { 
                resultType: 'staff',
                staffUsername: user.username,
                staffDeleted: user.isDeleted,
                data: combinedHistory, 
                error: null 
            });
        }
        
        // Case 2: Search by Borrower Name
        if (borrowerName) {
            const users = await User.find({});
            let totalBorrowed = 0;
            let returnedCount = 0;
            let notReturnedCount = 0;
            let totalFine = 0;
            let records = [];

            users.forEach(u => {
                // Check Issued Books (Active)
                u.issuedBooks.forEach(b => {
                    if (b.borrowerName && b.borrowerName.toLowerCase() === borrowerName.toLowerCase()) {
                        totalBorrowed++;
                        notReturnedCount++;
                        records.push({
                            bookName: b.bookName,
                            staff: u.username,
                            staffDeleted: u.isDeleted,
                            status: 'Issued',
                            date: b.issueDate,
                            fine: 0
                        });
                    }
                });

                // Check Returned Books
                u.returnHistory.forEach(b => {
                    if (b.borrowerName && b.borrowerName.toLowerCase() === borrowerName.toLowerCase()) {
                        totalBorrowed++;
                        returnedCount++;
                        totalFine += (b.fine || 0);
                        records.push({
                            bookName: b.bookName,
                            staff: u.username,
                            staffDeleted: u.isDeleted,
                            status: 'Returned',
                            date: b.returnDate,
                            fine: b.fine || 0
                        });
                    }
                });
            });

            if (totalBorrowed === 0) {
                return res.render("history", { resultType: null, data: null, error: "No records found for this borrower" });
            }

            records.sort((a, b) => new Date(b.date) - new Date(a.date));

            return res.render("history", { 
                resultType: 'borrower',
                borrowerName: borrowerName,
                stats: { totalBorrowed, returnedCount, notReturnedCount, totalFine },
                data: records,
                error: null
            });
        }

        res.render("history", { resultType: null, data: null, error: "Please enter a search term" });
    } catch (err) {
        console.log(err);
        res.render("history", { resultType: null, data: null, error: "Error fetching history" });
    }
});

// Export History Route
app.post("/export-history", async (req, res) => {
    const { username } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user) return res.redirect("/history");

        let csv = "Book Name,Borrower Name,Borrower Phone,Issue Date,Return Date,Fine\n";
        user.returnHistory.forEach(record => {
            csv += `"${record.bookName}","${record.borrowerName || ''}","${record.borrowerPhone || ''}",${record.issueDate ? record.issueDate.toDateString() : 'N/A'},${record.returnDate ? record.returnDate.toDateString() : 'N/A'},$${record.fine || 0}\n`;
        });

        res.header('Content-Type', 'text/csv');
        res.attachment(`${username}_history.csv`);
        return res.send(csv);
    } catch (err) {
        console.log(err);
        res.redirect("/history");
    }
});

// Admin Dashboard
app.get("/admin", async (req, res) => {
    try {
        const users = await User.find({});
        const books = await Book.find({});
        
        // Calculate Top Borrowers
        const borrowerCounts = {};
        const bookCounts = {};
        const finesByDate = {};

        users.forEach(u => {
            // Count from currently issued
            u.issuedBooks.forEach(b => {
                if (b.borrowerName) {
                    borrowerCounts[b.borrowerName] = (borrowerCounts[b.borrowerName] || 0) + 1;
                }
                if (b.bookName) {
                    bookCounts[b.bookName] = (bookCounts[b.bookName] || 0) + 1;
                }
            });
            // Count from history
            u.returnHistory.forEach(b => {
                if (b.borrowerName) {
                    borrowerCounts[b.borrowerName] = (borrowerCounts[b.borrowerName] || 0) + 1;
                }
                if (b.bookName) {
                    bookCounts[b.bookName] = (bookCounts[b.bookName] || 0) + 1;
                }
                if (b.fine > 0 && b.returnDate) {
                    const dateStr = b.returnDate.toISOString().split('T')[0];
                    finesByDate[dateStr] = (finesByDate[dateStr] || 0) + b.fine;
                }
            });
        });

        const topBorrowers = Object.entries(borrowerCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
        const mostBorrowedBooks = Object.entries(bookCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
        const finesData = Object.entries(finesByDate).map(([date, amount]) => ({ date, amount })).sort((a, b) => new Date(a.date) - new Date(b.date));

        let totalIssued = 0;
        let totalAvailable = 0;
        books.forEach(b => {
            totalIssued += (b.issued || 0);
            totalAvailable += (b.quantity || 0) - (b.issued || 0);
        });

        // Filter out deleted users for the management list
        const activeUsers = users.filter(u => !u.isDeleted);

        res.render("admin", { 
            users: activeUsers, 
            topBorrowers: topBorrowers, 
            maintenanceMode: maintenanceMode,
            mostBorrowedBooks,
            finesData,
            bookStatus: { issued: totalIssued, available: totalAvailable }
        });
    } catch (err) {
        console.log(err);
        res.send("Error fetching users");
    }
});

// Admin Delete User
app.post("/admin/delete-user", async (req, res) => {
    const { username } = req.body;
    try {
        await User.updateOne({ username }, { $set: { 
            isDeleted: true,
            originalUsername: username,
            username: `${username}_deleted_${Date.now()}`
        }});
        res.redirect("/admin");
    } catch (err) {
        console.log(err);
        res.redirect("/admin");
    }
});

// Admin Toggle Maintenance Mode
app.post("/admin/toggle-maintenance", async (req, res) => {
    try {
        maintenanceMode = !maintenanceMode;
        res.redirect("/admin");
    } catch (err) {
        console.log(err);
        res.redirect("/admin");
    }
});

// Admin Reset History
app.post("/admin/reset-history", async (req, res) => {
    try {
        await User.updateMany({}, { $set: { returnHistory: [], fines: 0 } });
        res.redirect("/admin");
    } catch (err) {
        console.log(err);
        res.redirect("/admin");
    }
});

// Admin Delete All Books
app.post("/admin/delete-all-books", async (req, res) => {
    try {
        await Book.deleteMany({});
        res.redirect("/admin");
    } catch (err) {
        console.log(err);
        res.redirect("/admin");
    }
});

// Print Receipt Route
app.post("/print-receipt", async (req, res) => {
    const { borrowerName } = req.body;
    try {
        const doc = new PDFDocument();
        const filename = `Receipt_${borrowerName || 'History'}.pdf`;

        res.setHeader('Content-disposition', 'attachment; filename="' + filename + '"');
        res.setHeader('Content-type', 'application/pdf');

        doc.pipe(res);

        doc.fontSize(20).text('Library Receipt', { align: 'center' });
        doc.moveDown();

        if (borrowerName) {
            doc.fontSize(14).text(`Borrower: ${borrowerName}`);
            doc.moveDown();

            const users = await User.find({});
            let totalFine = 0;

            users.forEach(u => {
                u.issuedBooks.forEach(b => {
                    if (b.borrowerName && b.borrowerName.toLowerCase() === borrowerName.toLowerCase()) {
                        doc.fontSize(12).text(`[Issued] ${b.bookName} - ${b.issueDate.toDateString()}`);
                    }
                });
                u.returnHistory.forEach(b => {
                    if (b.borrowerName && b.borrowerName.toLowerCase() === borrowerName.toLowerCase()) {
                        totalFine += (b.fine || 0);
                        doc.fontSize(12).text(`[Returned] ${b.bookName} - ${b.returnDate.toDateString()} (Fine: $${b.fine || 0})`);
                    }
                });
            });

            doc.moveDown();
            doc.fontSize(14).text(`Total Fine Paid/Due: $${totalFine}`);
        } else {
            doc.text("No borrower name provided.");
        }

        doc.end();
    } catch (err) {
        console.log(err);
        res.redirect("/admin");
    }
});

// Email Receipt Route
app.post("/email-receipt", async (req, res) => {
    const { borrowerName, borrowerEmail } = req.body;
    try {
        // Check if credentials are set correctly in .env
        if (!process.env.EMAIL_USER || process.env.EMAIL_USER.includes('put-your-real-gmail')) {
            throw new Error("Configuration Error: You must open the .env file and replace the placeholder text with your actual Gmail address and App Password.");
        }

        // Configure Nodemailer (Replace with your actual email credentials)
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const doc = new PDFDocument();
        
        // Generate PDF Content
        doc.fontSize(20).text('Library Receipt', { align: 'center' });
        doc.moveDown();

        if (borrowerName) {
            doc.fontSize(14).text(`Borrower: ${borrowerName}`);
            doc.moveDown();

            const users = await User.find({});
            let totalFine = 0;

            users.forEach(u => {
                u.issuedBooks.forEach(b => {
                    if (b.borrowerName && b.borrowerName.toLowerCase() === borrowerName.toLowerCase()) {
                        doc.fontSize(12).text(`[Issued] ${b.bookName} - ${b.issueDate.toDateString()}`);
                    }
                });
                u.returnHistory.forEach(b => {
                    if (b.borrowerName && b.borrowerName.toLowerCase() === borrowerName.toLowerCase()) {
                        totalFine += (b.fine || 0);
                        doc.fontSize(12).text(`[Returned] ${b.bookName} - ${b.returnDate.toDateString()} (Fine: $${b.fine || 0})`);
                    }
                });
            });
            doc.moveDown();
            doc.fontSize(14).text(`Total Fine Paid/Due: $${totalFine}`);
        }
        doc.end();

        // Send Email
        await transporter.sendMail({
            from: '"Library System" <your-email@gmail.com>',
            to: borrowerEmail,
            subject: `Library Receipt for ${borrowerName}`,
            text: 'Please find your library history receipt attached.',
            attachments: [{ filename: `Receipt_${borrowerName}.pdf`, content: doc }]
        });

        res.redirect("/history?message=Receipt sent successfully to " + borrowerEmail);
    } catch (err) {
        console.log(err);
        res.render("history", { resultType: null, data: null, error: "Error sending email: " + err.message, message: null });
    }
});

// Return All Books (Reset Library)
app.post("/return-all", async (req, res) => {
    const users = await User.find({});
    const returnDate = new Date();

    for (const user of users) {
        if (user.issuedBooks.length > 0) {
            user.issuedBooks.forEach(b => {
                // Calculate Fine
                const issueDate = new Date(b.issueDate);
                const diffTime = Math.abs(returnDate - issueDate);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                let fine = (diffDays > 7) ? (diffDays - 7) * 1 : 0;

                user.fines = (user.fines || 0) + fine;
                user.returnHistory.push({
                    bookName: b.bookName,
                    borrowerName: b.borrowerName,
                    borrowerPhone: b.borrowerPhone,
                    issueDate: b.issueDate,
                    returnDate: returnDate,
                    fine: fine
                });
            });
            user.issuedBooks = [];
            await user.save();
        }
    }
    await Book.updateMany({}, { $set: { issued: 0, bookState: "Available" } });
    res.redirect("/library?message=All books returned and history updated");
});

// API: Get Book Details by ISBN (Google Books)
app.get("/api/isbn", (req, res) => {
    const isbn = req.query.isbn;
    if (!isbn) return res.status(400).json({ error: "ISBN is required" });

    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;
    
    https.get(url, (apiRes) => {
        let data = '';
        apiRes.on('data', (chunk) => { data += chunk; });
        apiRes.on('end', () => {
            try {
                const json = JSON.parse(data);
                if (json.totalItems > 0) {
                    const info = json.items[0].volumeInfo;
                    res.json({
                        title: info.title,
                        authors: info.authors,
                        pageCount: info.pageCount,
                        publisher: info.publisher,
                        categories: info.categories,
                        imageLinks: info.imageLinks
                    });
                } else {
                    res.json({ error: "Book not found" });
                }
            } catch (e) { res.status(500).json({ error: "Error parsing external API" }); }
        });
    }).on('error', (e) => { res.status(500).json({ error: "API Request failed" }); });
});

// Route to display books by specific genre
app.get("/library/genre/:genreName", (req, res) => {
    const genre = req.params.genreName;
    res.redirect(`/library?genre=${encodeURIComponent(genre)}`);
});

// Library Page
app.get("/library", async (req, res) => {
    const searchQuery = req.query.search;
    const sortOption = req.query.sort;
    const filterOption = req.query.filter;
    const genreOption = req.query.genre;
    const message = req.query.message;
    const error = req.query.error;
    
    const page = parseInt(req.query.page) || 1;
    const limit = 12; // Books per page

    try {
        let query = {};
        if (searchQuery) {
            query.$or = [
                { bookName: { $regex: searchQuery, $options: 'i' } },
                { bookAuthor: { $regex: searchQuery, $options: 'i' } }
            ];
        }

        if (filterOption === 'available') {
            query.bookState = "Available";
        } else if (filterOption === 'issued') {
            query.bookState = "Issued";
        }

        if (genreOption && genreOption !== 'all') {
            query.bookGenre = genreOption;
        }

        let sort = {};
        if (sortOption === 'price_asc') {
            sort = { bookPrice: 1 };
        } else if (sortOption === 'price_desc') {
            sort = { bookPrice: -1 };
        }

        const genres = await Book.distinct("bookGenre");

        const totalBooks = await Book.countDocuments(query);
        const totalPages = Math.ceil(totalBooks / limit);
        const books = await Book.find(query)
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(limit);

        res.render("library", { 
            data: books, 
            searchQuery: searchQuery || '', 
            sortOption: sortOption || '',
            filterOption: filterOption || 'all',
            genreOption: genreOption || 'all',
            genres: genres.sort(),
            message: message || null,
            error: error || null,
            currentPage: page,
            totalPages: totalPages
        });
    } catch (err) {
        console.log(err);
        res.send("Error fetching books");
    }
});

// Inventory Page
app.get("/inventory", async (req, res) => {
    try {
        const books = await Book.find({});
        res.render("inventory", { books: books });
    } catch (err) {
        console.log(err);
        res.send("Error fetching inventory");
    }
});

// Add Book Route
app.post("/add", upload.single('bookCover'), async (req, res) => {
    try {
        const newBook = new Book({
            bookName: req.body.bookName,
            bookAuthor: req.body.bookAuthor,
            bookPages: req.body.bookPages,
            bookPrice: req.body.bookPrice,
            bookPublication: req.body.bookPublication,
            bookGenre: req.body.bookGenre,
            bookCover: req.file ? `/uploads/${req.file.filename}` : (req.body.remoteCoverUrl || null),
            bookState: "Available",
            quantity: 10,
            issued: 0
        });
        await newBook.save();
        res.redirect("/library?message=Book added successfully");
    } catch (err) {
        console.log(err);
        res.redirect("/library?error=Error adding book");
    }
});

// Update Book Cover Route
app.post("/update-book-cover", upload.single('bookCover'), async (req, res) => {
    const { bookName } = req.body;
    try {
        if (req.file && bookName) {
            await Book.updateOne({ bookName }, { $set: { bookCover: `/uploads/${req.file.filename}` } });
            res.redirect("/library?message=Book cover updated successfully");
        } else {
            res.redirect("/library?error=Please select an image to upload");
        }
    } catch (err) {
        console.log(err);
        res.redirect("/library?error=Error updating book cover");
    }
});

// Edit Book Details Route
app.post("/edit-book", async (req, res) => {
    const { originalBookName, bookName, bookAuthor, bookPages, bookPrice, bookPublication, quantity, bookGenre } = req.body;
    try {
        if (originalBookName !== bookName) {
            const existing = await Book.findOne({ bookName: bookName });
            if (existing) {
                return res.redirect("/library?error=Cannot rename: Book with new name already exists");
            }
        }

        const book = await Book.findOne({ bookName: originalBookName });
        if (!book) {
            return res.redirect("/library?error=Book not found");
        }

        book.bookName = bookName;
        book.bookAuthor = bookAuthor;
        book.bookPages = bookPages;
        book.bookPrice = bookPrice;
        book.bookPublication = bookPublication;
        book.bookGenre = bookGenre;
        book.quantity = quantity;
        
        // Update state based on new quantity
        if (book.issued >= book.quantity) {
            book.bookState = "Issued";
        } else {
            book.bookState = "Available";
        }
        
        await book.save();

        // If name changed, update references in User collection
        if (originalBookName !== bookName) {
             await User.updateMany({ "issuedBooks.bookName": originalBookName }, { $set: { "issuedBooks.$[elem].bookName": bookName } }, { arrayFilters: [{ "elem.bookName": originalBookName }] });
             await User.updateMany({ "returnHistory.bookName": originalBookName }, { $set: { "returnHistory.$[elem].bookName": bookName } }, { arrayFilters: [{ "elem.bookName": originalBookName }] });
        }

        res.redirect("/library?message=Book details updated successfully");
    } catch (err) {
        console.log(err);
        res.redirect("/library?error=Error updating book details");
    }
});

// Profile Picture Upload Route
app.post("/profile/upload", upload.single('profilePic'), async (req, res) => {
    const { username } = req.body;
    if (req.file && username) {
        await User.updateOne({ username }, { $set: { profilePic: `/uploads/${req.file.filename}` } });
        const user = await User.findOne({ username });
        res.render("profile", { user: user, error: null, success: "Profile picture updated" });
    } else {
        res.redirect("/profile?error=Upload failed");
    }
});

// Issue Book Route
app.post("/issue", async (req, res) => {
    const { bookName, username, borrowerName, borrowerPhone } = req.body;
    
    const user = await User.findOne({ username });
    if (!user || user.isDeleted) {
        return res.redirect("/library?error=User not found. Please check the username.");
    }

    // Role-based limits
    if (user.role === "Librarian") {
        // No limits for Librarian
    } else if (user.role === "Assistant") {
        if (user.issuedBooks.length >= 20) {
            return res.redirect("/library?error=Limit reached: Assistants can only borrow 20 books at a time.");
        }
        const sameBookCount = user.issuedBooks.filter(b => b.bookName === bookName).length;
        if (sameBookCount >= 5) {
            return res.redirect("/library?error=Limit reached: Assistants can only borrow 5 copies of the same book.");
        }
    }

    // Check Borrower Limits (Global check across all users/staff)
    // "Same borrower can only get 5 books (different) at a time"
    const allUsers = await User.find({});
    let borrowerBookCount = 0;
    let borrowerHasThisBook = false;

    allUsers.forEach(u => {
        u.issuedBooks.forEach(b => {
            if (b.borrowerName === borrowerName && b.borrowerPhone === borrowerPhone) {
                borrowerBookCount++;
                if (b.bookName === bookName) borrowerHasThisBook = true;
            }
        });
    });

    if (borrowerBookCount >= 5) {
        return res.redirect("/library?error=Limit reached: This borrower already has 5 books.");
    }
    if (borrowerHasThisBook) {
        return res.redirect("/library?error=Limit reached: This borrower already has this book.");
    }

    const book = await Book.findOne({ bookName: bookName });
    if (book && book.issued < book.quantity) {
        book.issued += 1;
        if (book.issued === book.quantity) {
            book.bookState = "Issued";
        }
        await book.save();

        user.issuedBooks.push({ 
            bookName: bookName,
            borrowerName: borrowerName,
            borrowerPhone: borrowerPhone
        });
        await user.save();
        return res.redirect("/library?message=Book Issued Successfully");
    }
    res.redirect("/library?error=Book could not be issued (Out of stock or invalid).");
});

// Return Book Route
app.post("/return", async (req, res) => {
    const { bookName, username, borrowerName, borrowerPhone } = req.body;
    
    const user = await User.findOne({ username });
    if (!user) {
        return res.redirect("/library?error=User not found. Please check the username.");
    }

    // Check if user actually has the book
    const hasBook = user.issuedBooks.some(b => 
        b.bookName === bookName && b.borrowerName === borrowerName && b.borrowerPhone === borrowerPhone
    );
    if (!hasBook) {
        return res.redirect("/library?error=No record found for this borrower and book.");
    }

    const book = await Book.findOne({ bookName: bookName });
    
    if (book && book.issued > 0) {
        book.issued -= 1;
        book.bookState = "Available";
        await book.save();

        // Remove one instance of the book from user's list
        const index = user.issuedBooks.findIndex(b => 
            b.bookName === bookName && b.borrowerName === borrowerName && b.borrowerPhone === borrowerPhone
        );
        if (index > -1) {
            const bookRecord = user.issuedBooks[index];
            
            // Calculate Fine ($1/day after 7 days)
            const returnDate = new Date();
            const issueDate = new Date(bookRecord.issueDate);
            const diffTime = Math.abs(returnDate - issueDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            let fine = 0;
            if (diffDays > 7) {
                fine = (diffDays - 7) * 1;
            }
            user.fines = (user.fines || 0) + fine;

            // Add to return history before removing
            user.returnHistory.push({
                bookName: bookRecord.bookName,
                borrowerName: bookRecord.borrowerName,
                borrowerPhone: bookRecord.borrowerPhone,
                issueDate: bookRecord.issueDate,
                returnDate: returnDate,
                fine: fine
            });

            user.issuedBooks.splice(index, 1);
            await user.save();
            
            if (fine > 0) {
                return res.redirect(`/library?message=Book Returned Successfully. Fine incurred: $${fine}`);
            }
        }
        return res.redirect("/library?message=Book Returned Successfully");
    }
    res.redirect("/library?error=Book return failed.");
});

// Delete Book Route
app.post("/delete", async (req, res) => {
    const requestedBookName = req.body.bookName;
    await Book.deleteOne({ bookName: requestedBookName });
    res.redirect("/library");
});