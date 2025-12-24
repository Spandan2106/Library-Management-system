require('dotenv').config();
console.log("Email User loaded:", process.env.EMAIL_USER);
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const app = express();
const PORT = 3000;

let maintenanceMode = false;

// Schemas
const bookSchema = new mongoose.Schema({
    bookName: String,
    bookAuthor: String,
    bookPages: Number,
    bookPrice: Number,
    bookPublication: String,
    bookState: { type: String, default: "Available" },
    quantity: { type: Number, default: 10 },
    issued: { type: Number, default: 0 }
});

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
mongoose.connect("mongodb://127.0.0.1:27017/libraryDB")
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
                    bookState: "Available"
                },
                {
                    bookName: "Atomic Habits",
                    bookAuthor: "James Clear",
                    bookPages: 320,
                    bookPrice: 300,
                    bookPublication: "Penguin Random House",
                    bookState: "Available"
                },
                {
                    bookName: "Deep Work",
                    bookAuthor: "Cal Newport",
                    bookPages: 304,
                    bookPrice: 350,
                    bookPublication: "Grand Central Publishing",
                    bookState: "Available"
                },
                {
                    bookName:"The Power of Habit",
                    bookAuthor: "Charles Duhigg",
                    bookPages: 371,
                    bookPrice: 280,
                    bookPublication: "Random House",
                    bookState: "Available"
                },
                {
                    bookName: "Thinking, Fast and Slow",
                    bookAuthor: "Daniel Kahneman",
                    bookPages: 499,
                    bookPrice: 400,
                    bookPublication: "Farrar, Straus and Giroux",
                    bookState: "Available"
                },
                {
                    bookName: "Grit: The Power of Passion and Perseverance",
                    bookAuthor: "Angela Duckworth",
                    bookPages: 352, 
                    bookPrice: 320,
                    bookPublication: "Scribner",
                    bookState: "Available"
                },
                {
                    bookName: "Mindset: The New Psychology of Success",
                    bookAuthor: "Carol S. Dweck",
                    bookPages: 320,
                    bookPrice: 290,
                    bookPublication: "Random House",
                    bookState: "Available"
                },
                {
                    bookName: "The 7 Habits of Highly Effective People",
                    bookAuthor: "Stephen R. Covey",
                    bookPages: 381,
                    bookPrice: 360,
                    bookPublication: "Free Press",
                    bookState: "Available"
                },
                {
                    bookName: "Drive: The Surprising Truth About What Motivates Us",
                    bookAuthor: "Daniel H. Pink",
                    bookPages: 272,
                    bookPrice: 310,
                    bookPublication: "Riverhead Books",
                    bookState: "Available"
                },
                {
                    bookName: "The Subtle Art of Not Giving a F*ck",
                    bookAuthor: "Mark Manson",
                    bookPages: 224,
                    bookPrice: 250,
                    bookPublication: "Harper",
                    bookState: "Available"
                },
                {
                    bookName: "Outliers: The Story of Success",
                    bookAuthor: "Malcolm Gladwell",
                    bookPages: 336,
                    bookPrice: 330,
                    bookPublication: "Little, Brown and Company",
                    bookState: "Available"
                },
                {
                    bookName: "Quiet: The Power of Introverts in a World That Can't Stop Talking",
                    bookAuthor: "Susan Cain",
                    bookPages: 368,
                    bookPrice: 340,
                    bookPublication: "Crown Publishing Group",
                    bookState: "Available"
                },
                {
                    bookName: "The Four Agreements",
                    bookAuthor: "Don Miguel Ruiz",
                    bookPages: 160,
                    bookPrice: 220,
                    bookPublication: "Amber-Allen Publishing",
                    bookState: "Available"
                },
                {
                    bookName: "Flow: The Psychology of Optimal Experience",
                    bookAuthor: "Mihaly Csikszentmihalyi",
                    bookPages: 336,
                    bookPrice: 300,
                    bookPublication: "Harper & Row",
                    bookState: "Available"
                },
                {
                    bookName: "Emotional Intelligence",
                    bookAuthor: "Daniel Goleman",
                    bookPages: 352,
                    bookPrice: 350,
                    bookPublication: "Bantam Books",
                    bookState: "Available"
                },
                {
                    bookName: "The Happiness Advantage",
                    bookAuthor: "Shawn Achor",
                    bookPages: 256,
                    bookPrice: 280,
                    bookPublication: "Crown Business",
                    bookState: "Available"
                },
                {
                    bookName: "Dare to Lead",
                    bookAuthor: "Brené Brown",
                    bookPages: 320,
                    bookPrice: 360,
                    bookPublication: "Random House",
                    bookState: "Available"
                },
                {
                    bookName: "Start with Why",
                    bookAuthor: "Simon Sinek",
                    bookPages: 256,
                    bookPrice: 300,
                    bookPublication: "Portfolio",
                    bookState: "Available"
                },
                {
                    bookName: "The Lean Startup",
                    bookAuthor: "Eric Ries",
                    bookPages: 336,
                    bookPrice: 320,
                    bookPublication: "Crown Business",
                    bookState: "Available"
                },
                {
                    bookName: "Good to Great",
                    bookAuthor: "Jim Collins",
                    bookPages: 320,
                    bookPrice: 340,
                    bookPublication: "HarperBusiness",
                    bookState: "Available"
                },
                {
                    bookName: "Zero to One",
                    bookAuthor: "Peter Thiel",
                    bookPages: 224,
                    bookPrice: 310,
                    bookPublication: "Crown Business",
                    bookState: "Available"
                },
                {
                    bookName: "The Hard Thing About Hard Things",
                    bookAuthor: "Ben Horowitz",
                    bookPages: 304,
                    bookPrice: 330,
                    bookPublication: "HarperBusiness",
                    bookState: "Available"
                },
                {
                    bookName: "Measure What Matters",
                    bookAuthor: "John Doerr",
                    bookPages: 320,
                    bookPrice: 350,
                    bookPublication: "Portfolio",
                    bookState: "Available"
                },
                {
                    bookName: "Thinking in Bets",
                    bookAuthor: "Annie Duke",
                    bookPages: 304,
                    bookPrice: 290,
                    bookPublication: "Portfolio",
                    bookState: "Available"
                },
                {
                    bookName: "Principles: Life and Work",
                    bookAuthor: "Ray Dalio",
                    bookPages: 592,
                    bookPrice: 400,
                    bookPublication: "Simon & Schuster",
                    bookState: "Available"
                },
                {
                    bookName: "The Innovator's Dilemma",
                    bookAuthor: "Clayton M. Christensen",
                    bookPages: 286,
                    bookPrice: 320,
                    bookPublication: "Harvard Business Review Press",
                    bookState: "Available"
                },
                {
                    bookName: "Blue Ocean Strategy",
                    bookAuthor: "W. Chan Kim & Renée Mauborgne",
                    bookPages: 256,
                    bookPrice: 300,
                    bookPublication: "Harvard Business Review Press",
                    bookState: "Available"
                },
                {
                    bookName: "The E-Myth Revisited",
                    bookAuthor: "Michael E. Gerber",
                    bookPages: 288,
                    bookPrice: 280,
                    bookPublication: "HarperCollins",
                    bookState: "Available"
                },
                {
                    bookName: "Crushing It!",
                    bookAuthor: "Gary Vaynerchuk",
                    bookPages: 288,
                    bookPrice: 310,
                    bookPublication: "HarperBusiness",
                    bookState: "Available"
                },
                {
                    bookName: "Jab, Jab, Jab, Right Hook",
                    bookAuthor: "Gary Vaynerchuk",
                    bookPages: 240,
                    bookPrice: 270,
                    bookPublication: "HarperBusiness",
                    bookState: "Available"
                },
                {
                    bookName: "Contagious: How to Build Word of Mouth in the Digital Age",
                    bookAuthor: "Jonah Berger",
                    bookPages: 256,
                    bookPrice: 290,
                    bookPublication: "Simon & Schuster",
                    bookState: "Available"
                },
                {
                    bookName: "Made to Stick",
                    bookAuthor: "Chip Heath & Dan Heath",
                    bookPages: 336,
                    bookPrice: 300,
                    bookPublication: "Random House",
                    bookState: "Available"
                },
                {
                    bookName: "Influence: The Psychology of Persuasion",
                    bookAuthor: "Robert B. Cialdini",
                    bookPages: 336,
                    bookPrice: 320,
                    bookPublication: "Harper Business",
                    bookState: "Available"
                },
                {
                    bookName: "Pre-Suasion: A Revolutionary Way to Influence and Persuade",
                    bookAuthor: "Robert B. Cialdini",
                    bookPages: 432,
                    bookPrice: 350,
                    bookPublication: "Simon & Schuster",
                    bookState: "Available"

                },
                {
                    bookName: "Thinking, Fast and Slow",
                    bookAuthor: "Daniel Kahneman",
                    bookPages: 499,
                    bookPrice: 400,
                    bookPublication: "Farrar, Straus and Giroux",
                    bookState: "Available"
                },
                {
                    bookName: "Switch: How to Change Things When Change Is Hard",
                    bookAuthor: "Chip Heath & Dan Heath",
                    bookPages: 320,
                    bookPrice: 300,
                    bookPublication: "Broadway Books",
                    bookState: "Available"
                },
                {
                    bookName: "The Art of Thinking Clearly",
                    bookAuthor: "Rolf Dobelli",
                    bookPages: 384,
                    bookPrice: 280,
                    bookPublication: "HarperBusiness",
                    bookState: "Available"
                },
                {
                    bookName: "Nudge: Improving Decisions About Health, Wealth, and Happiness",
                    bookAuthor: "Richard H. Thaler & Cass R. Sunstein",
                    bookPages: 312,
                    bookPrice: 320,
                    bookPublication: "Penguin Books",
                    bookState: "Available"
                },
                {
                    bookName: "Predictably Irrational",
                    bookAuthor: "Dan Ariely",
                    bookPages: 384,
                    bookPrice: 300,
                    bookPublication: "HarperCollins",
                    bookState: "Available"
                },
                {
                    bookName: "Misbehaving: The Making of Behavioral Economics",
                    bookAuthor: "Richard H. Thaler",
                    bookPages: 432,
                    bookPrice: 350,
                    bookPublication: "W. W. Norton & Company",
                    bookState: "Available"
                },
                {
                    bookName: "Thinking in Systems: A Primer",
                    bookAuthor: "Donella H. Meadows",
                    bookPages: 240,
                    bookPrice: 270,
                    bookPublication: "Chelsea Green Publishing",
                    bookState: "Available"
                },
                {
                    bookName: "The Fifth Discipline: The Art & Practice of The Learning Organization",
                    bookAuthor: "Peter M. Senge",
                    bookPages: 424,
                    bookPrice: 380,
                    bookPublication: "Doubleday",
                    bookState: "Available"
                },
                {
                    bookName: "Antifragile: Things That Gain from Disorder",
                    bookAuthor: "Nassim Nicholas Taleb",
                    bookPages: 519,
                    bookPrice: 400,
                    bookPublication: "Random House",
                    bookState: "Available"
                },
                {
                    bookName: "Skin in the Game: Hidden Asymmetries in Daily Life",
                    bookAuthor: "Nassim Nicholas Taleb",
                    bookPages: 304,
                    bookPrice: 320,
                    bookPublication: "Random House",
                    bookState: "Available"
                },
                {
                    bookName: "Fooled by Randomness: The Hidden Role of Chance in Life and in the Markets",
                    bookAuthor: "Nassim Nicholas Taleb",
                    bookPages: 316,
                    bookPrice: 300,
                    bookPublication: "Random House",
                    bookState: "Available"
                },
                {
                    bookName: "The Black Swan: The Impact of the Highly Improbable",
                    bookAuthor: "Nassim Nicholas Taleb",
                    bookPages: 444,
                    bookPrice: 350,
                    bookPublication: "Random House",
                    bookState: "Available"
                },
                {
                    bookName: "Learning from Data",
                    bookAuthor: "Yaser S. Abu-Mostafa, Malik Magdon-Ismail, Hsuan-Tien Lin",
                    bookPages: 312,
                    bookPrice: 330,
                    bookPublication: "AMLBook",
                    bookState: "Available"
                },
                {
                    bookName: "Pattern Recognition and Machine Learning",
                    bookAuthor: "Christopher M. Bishop",
                    bookPages: 738,
                    bookPrice: 450,
                    bookPublication: "Springer",
                    bookState: "Available"
                },
                {
                    bookName: "Deep Learning",
                    bookAuthor: "Ian Goodfellow, Yoshua Bengio, Aaron Courville",
                    bookPages: 800,
                    bookPrice: 500,
                    bookPublication: "MIT Press",
                    bookState: "Available"
                },
                {
                    bookName: "Artificial Intelligence: A Modern Approach",
                    bookAuthor: "Stuart Russell, Peter Norvig",
                    bookPages: 1152,
                    bookPrice: 550,
                    bookPublication: "Pearson",
                    bookState: "Available"
                },
                {
                    bookName: "Reinforcement Learning: An Introduction",
                    bookAuthor: "Richard S. Sutton, Andrew G. Barto",
                    bookPages: 552, 
                    bookPrice: 400,
                    bookPublication: "MIT Press",
                    bookState: "Available"
                },
                {
                    bookName: "The Elements of Statistical Learning",
                    bookAuthor: "Trevor Hastie, Robert Tibshirani, Jerome Friedman",
                    bookPages: 745,
                    bookPrice: 450,
                    bookPublication: "Springer",
                    bookState: "Available"
                },
                {
                    bookName: "Data Science for Business",
                    bookAuthor: "Foster Provost, Tom Fawcett",
                    bookPages: 414,
                    bookPrice: 350,
                    bookPublication: "O'Reilly Media",
                    bookState: "Available"
                },
                {
                    bookName: "Python Machine Learning",
                    bookAuthor: "Sebastian Raschka, Vahid Mirjalili",
                    bookPages: 770,
                    bookPrice: 400,
                    bookPublication: "Packt Publishing",
                    bookState: "Available"
                },
                {
                    bookName: "Hands-On Machine Learning with Scikit-Learn, Keras, and TensorFlow",
                    bookAuthor: "Aurélien Géron",
                    bookPages: 850,
                    bookPrice: 450,
                    bookPublication: "O'Reilly Media",
                    bookState: "Available"
                },
                {
                    bookName: "Machine Learning Yearning",
                    bookAuthor: "Andrew Ng",
                    bookPages: 200,
                    bookPrice: 300,
                    bookPublication: "Self-published",
                    bookState: "Available"
                },
                {
                    bookName: "Introduction to Machine Learning with Python",
                    bookAuthor: "Andreas C. Müller, Sarah Guido",
                    bookPages: 400,
                    bookPrice: 350,
                    bookPublication: "O'Reilly Media",
                    bookState: "Available"
                },
                {
                    bookName: "Mining of Massive Datasets",
                    bookAuthor: "Jure Leskovec, Anand Rajaraman, Jeffrey D. Ullman",
                    bookPages: 500,
                    bookPrice: 400,
                    bookPublication: "Cambridge University Press",
                    bookState: "Available"
                },
                {
                    bookName: "The Hundred-Page Machine Learning Book",
                    bookAuthor: "Andriy Burkov",
                    bookPages: 100,
                    bookPrice: 250,
                    bookPublication: "Andriy Burkov",
                    bookState: "Available"

                },
                {
                    bookName: "Grokking Deep Learning",
                    bookAuthor: "Andrew W. Trask",
                    bookPages: 300,
                    bookPrice: 350,
                    bookPublication: "Manning Publications",
                    bookState: "Available"
                },
                {
                    bookName: "Bayesian Reasoning and Machine Learning",
                    bookAuthor: "David Barber",
                    bookPages: 600,
                    bookPrice: 450,
                    bookPublication: "Cambridge University Press",
                    bookState: "Available"
                },
                {
                    bookName: "Probabilistic Graphical Models: Principles and Techniques",
                    bookAuthor: "Daphne Koller, Nir Friedman",
                    bookPages: 1200,
                    bookPrice: 600,
                    bookPublication: "MIT Press",
                    bookState: "Available"
                },
                {
                    bookName: "Speech and Language Processing",
                    bookAuthor: "Daniel Jurafsky, James H. Martin",
                    bookPages: 1000,
                    bookPrice: 550,
                    bookPublication: "Pearson",
                    bookState: "Available"
                },
                {
                    bookName: "Computer Vision: Algorithms and Applications",
                    bookAuthor: "Richard Szeliski",
                    bookPages: 812,
                    bookPrice: 500,
                    bookPublication: "Springer",
                    bookState: "Available"
                }
                ,
                {
                    bookName: "Pattern Recognition",
                    bookAuthor: "Sergios Theodoridis, Konstantinos Koutroumbas",
                    bookPages: 800,
                    bookPrice: 450,
                    bookPublication: "Academic Press",
                    bookState: "Available"
                },
                {
                    bookName: "Data Mining: Concepts and Techniques",
                    bookAuthor: "Jiawei Han, Micheline Kamber, Jian Pei",
                    bookPages: 800,
                    bookPrice: 450,
                    bookPublication: "Morgan Kaufmann",
                    bookState: "Available"

                },
                {
                    bookName: "An Introduction to Statistical Learning",
                    bookAuthor: "Gareth James, Daniela Witten, Trevor Hastie, Robert Tibshirani",
                    bookPages: 426,
                    bookPrice: 350,
                    bookPublication: "Springer",
                    bookState: "Available"
                },
                {
                    bookName: "The Master Algorithm",
                    bookAuthor: "Pedro Domingos",
                    bookPages: 352,
                    bookPrice: 300,
                    bookPublication: "Basic Books",
                    bookState: "Available"
                },
                {
                    bookName: "Machine Learning: A Probabilistic Perspective",
                    bookAuthor: "Kevin P. Murphy",
                    bookPages: 1104,
                    bookPrice: 600,
                    bookPublication: "MIT Press",
                    bookState: "Available"
                },
                {
                    bookName: "Artificial Intelligence and Machine Learning for Business",
                    bookAuthor: "Steven Finlay",
                    bookPages: 250,
                    bookPrice: 300,
                    bookPublication: "Wiley",
                    bookState: "Available"
                },
                {
                    bookName: "Data Science from Scratch",
                    bookAuthor: "Joel Grus",
                    bookPages: 330,
                    bookPrice: 320,
                    bookPublication: "O'Reilly Media",
                    bookState: "Available"
                },
                {
                    bookName: "The Data Warehouse Toolkit",
                    bookAuthor: "Ralph Kimball, Margy Ross",
                    bookPages: 552,
                    bookPrice: 400,
                    bookPublication: "Wiley",
                    bookState: "Available"
                },
                {
                    bookName: "Big Data: Principles and Best Practices of Scalable Real-Time Data Systems",
                    bookAuthor: "Nathan Marz, James Warren",
                    bookPages: 300,
                    bookPrice: 350,
                    bookPublication: "Manning Publications",
                    bookState: "Available"
                },
                {
                    bookName: "Hadoop: The Definitive Guide",
                    bookAuthor: "Tom White",
                    bookPages: 600,
                    bookPrice: 450,
                    bookPublication: "O'Reilly Media",
                    bookState: "Available"
                },
                {
                    bookName: "Spark: The Definitive Guide",
                    bookAuthor: "Bill Chambers, Matei Zaharia",
                    bookPages: 552,
                    bookPrice: 450,
                    bookPublication: "O'Reilly Media",
                    bookState: "Available"
                },
                {
                    bookName: "NoSQL Distilled: A Brief Guide to the Emerging World of Polyglot Persistence",
                    bookAuthor: "Pramod J. Sadalage, Martin Fowler",
                    bookPages: 176,
                    bookPrice: 300,
                    bookPublication: "Addison-Wesley Professional",
                    bookState: "Available"
                },
                {
                    bookName: "Designing Data-Intensive Applications",
                    bookAuthor: "Martin Kleppmann",
                    bookPages: 616,
                    bookPrice: 500,
                    bookPublication: "O'Reilly Media",
                    bookState: "Available"
                },
                {
                    bookName: "Streaming Systems: The What, Where, When, and How of Large-Scale Data Processing",
                    bookAuthor: "Tyler Akidau, Slava Chernyak, Reuven Lax",
                    bookPages: 400,
                    bookPrice: 450,
                    bookPublication: "O'Reilly Media",
                    bookState: "Available"
                },
                {
                    bookName: "Game of Thrones",
                    bookAuthor: "George R. R. Martin",
                    bookPages: 694,
                    bookPrice: 500,
                    bookPublication: "Bantam Spectra",
                    bookState: "Available"
                },
                {
                    bookName: "To Kill a Mockingbird",
                    bookAuthor: "Harper Lee",
                    bookPages: 281,
                    bookPrice: 300,
                    bookPublication: "J.B. Lippincott & Co.",
                    bookState: "Available"
                },
                {
                    bookName: "1984",
                    bookAuthor: "George Orwell",
                    bookPages: 328,
                    bookPrice: 350,
                    bookPublication: "Secker & Warburg",
                }
                ,
                {
                    bookName: "The Great Gatsby",
                    bookAuthor: "F. Scott Fitzgerald",
                    bookPages: 180,
                    bookPrice: 250,
                    bookPublication: "Charles Scribner's Sons",
                    bookState: "Available"
                },
                {
                    bookName: "The Catch-22",
                    bookAuthor: "Joseph Heller",
                    bookPages: 453,
                    bookPrice: 400,
                    bookPublication: "Simon & Schuster",
                    bookState: "Available"
                },
                {
                    bookName: "The Lord of the Rings",
                    bookAuthor: "J.R.R. Tolkien",
                    bookPages: 1216,
                    bookPrice: 600,
                    bookPublication: "Allen & Unwin",
                    bookState: "Available"
                },
                {
                    bookName: "Pride and Prejudice",
                    bookAuthor: "Jane Austen",
                    bookPages: 279,
                    bookPrice: 300,
                    bookPublication: "T. Egerton, Whitehall",
                    bookState: "Available"
                },
                {
                    bookName: "The Hobbit",
                    bookAuthor: "J.R.R. Tolkien",
                    bookPages: 310,
                    bookPrice: 350,
                    bookPublication: "Allen & Unwin",
                    bookState: "Available"
                },
                {
                    bookName: "Fahrenheit 451",
                    bookAuthor: "Ray Bradbury",
                    bookPages: 194,
                    bookPrice: 280,
                    bookPublication: "Ballantine Books",
                    bookState: "Available"
                },
                {
                    bookName: "Jane Eyre",
                    bookAuthor: "Charlotte Brontë",
                    bookPages: 500,
                    bookPrice: 400,
                    bookPublication: "Smith, Elder & Co.",
                    bookState: "Available"
                },
                {
                    bookName: "Brave New World",
                    bookAuthor: "Aldous Huxley",
                    bookPages: 311,
                    bookPrice: 350,
                    bookPublication: "Chatto & Windus",
                    bookState: "Available"
                },
                {
                    bookName: "Animal Farm",
                    bookAuthor: "George Orwell",
                    bookPages: 112,
                    bookPrice: 200,
                    bookPublication: "Secker & Warburg",
                    bookState: "Available"

                },
                {
                    bookName: "Wuthering Heights",
                    bookAuthor: "Emily Brontë",
                    bookPages: 416,
                    bookPrice: 380,
                    bookPublication: "Thomas Cautley Newby",
                    bookState: "Available"
                },
                {
                    bookName: "The Chronicles of Narnia",
                    bookAuthor: "C.S. Lewis",
                    bookPages: 767,
                    bookPrice: 550,
                    bookPublication: "Geoffrey Bles",
                    bookState: "Available"
                },
                {
                    bookName: "The Picture of Dorian Gray",
                    bookAuthor: "Oscar Wilde",
                    bookPages: 254,
                    bookPrice: 300,
                    bookPublication: "Lippincott's Monthly Magazine",
                    bookState: "Available"

                },
                {
                    bookName: "Dracula",
                    bookAuthor: "Bram Stoker",
                    bookPages: 418,
                    bookPrice: 400,
                    bookPublication: "Archibald Constable and Company",
                    bookState: "Available"
                },
                {
                    bookName: "The Count of Monte Cristo",
                    bookAuthor: "Alexandre Dumas",
                    bookPages: 1276,
                    bookPrice: 650,
                    bookPublication: "Penguin Classics",
                    bookState: "Available"

                },
                {
                    bookName: "Les Misérables",
                    bookAuthor: "Victor Hugo",
                    bookPages: 1463,
                    bookPrice: 700,
                    bookPublication: "A. Lacroix, Verboeckhoven & Cie.",
                    bookState: "Available"
                },
                {
                    bookName: "The Odyssey",
                    bookAuthor: "Homer",
                    bookPages: 541,
                    bookPrice: 450,
                    bookPublication: "Penguin Classics",
                    bookState: "Available"
                },
                {
                    bookName: "Moby-Dick",
                    bookAuthor: "Herman Melville",
                    bookPages: 585,
                    bookPrice: 400,
                    bookPublication: "Harper & Brothers",
                    bookState: "Available"
                },
                {
                    bookName: "War and Peace",
                    bookAuthor: "Leo Tolstoy",
                    bookPages: 1225,
                    bookPrice: 700,
                    bookPublication: "The Russian Messenger",
                    bookState: "Available"
                },
                {
                    bookName: "Crime and Punishment",
                    bookAuthor: "Fyodor Dostoevsky",
                    bookPages: 671,
                    bookPrice: 500,
                    bookPublication: "The Russian Messenger",
                    bookState: "Available"

                },
                {
                    bookName: "The Brothers Karamazov",
                    bookAuthor: "Fyodor Dostoevsky",
                    bookPages: 824,
                    bookPrice: 550,
                    bookPublication: "The Russian Messenger",
                    bookState: "Available"
                },
                {
                    bookName: "Madame Bovary",
                    bookAuthor: "Gustave Flaubert",
                    bookPages: 329,
                    bookPrice: 350,
                    bookPublication: "Revue de Paris",
                    bookState: "Available"

                },
                {
                    bookName: "The Divine Comedy",
                    bookAuthor: "Dante Alighieri",
                    bookPages: 798,
                    bookPrice: 600,
                    bookPublication: "John Murray",
                    bookState: "Available"
                },
                {
                    bookName: "Hamlet",
                    bookAuthor: "William Shakespeare",
                    bookPages: 342,
                    bookPrice: 300,
                    bookPublication: "N/A",
                    bookState: "Available"
                },
                {
                    bookName: "The Adventures of Huckleberry Finn",
                    bookAuthor: "Mark Twain",
                    bookPages: 366,
                    bookPrice: 350,
                    bookPublication: "Chatto & Windus / Charles L. Webster And Company",
                    bookState: "Available"
                },
                {
                    bookName: "The Iliad",
                    bookAuthor: "Homer",
                    bookPages: 683,
                    bookPrice: 450,
                    bookPublication: "Penguin Classics",
                    bookState: "Available"
                },
                {
                    bookName: "Don Quixote",
                    bookAuthor: "Miguel de Cervantes",
                    bookPages: 1072,
                    bookPrice: 650,
                    bookPublication: "Francisco de Robles",
                    bookState: "Available"
                },
                {
                    bookName: "One Hundred Years of Solitude",
                    bookAuthor: "Gabriel García Márquez",
                    bookPages: 417,
                    bookPrice: 400,
                    bookPublication: "Harper & Row",
                    bookState: "Available"
                },
                {
                    bookName: "The Sound and the Fury",
                    bookAuthor: "William Faulkner",
                    bookPages: 326,
                    bookPrice: 350,
                    bookPublication: "Jonathan Cape and Harrison Smith",
                    bookState: "Available"

                },
                {
                    bookName: "Great Expectations",
                    bookAuthor: "Charles Dickens",
                    bookPages: 505,
                    bookPrice: 450,
                    bookPublication: "Chapman & Hall",
                    bookState: "Available"
                },
                {
                    bookName: "Lolita",
                    bookAuthor: "Vladimir Nabokov",
                    bookPages: 336,
                    bookPrice: 350,
                    bookPublication: "Olympia Press",
                    bookState: "Available"
                },
                {
                    bookName: "Catch-22",
                    bookAuthor: "Joseph Heller",
                    bookPages: 453,
                    bookPrice: 400,
                    bookPublication: "Simon & Schuster",
                    bookState: "Available"
                }
            ];
        
        if (count !== initialBooks.length) {
            await Book.deleteMany({});
            await Book.insertMany(initialBooks);
            console.log("Database updated with new books");
        }
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
        
        // Calculate Top Borrowers
        const borrowerCounts = {};
        users.forEach(u => {
            // Count from currently issued
            u.issuedBooks.forEach(b => {
                if (b.borrowerName) {
                    borrowerCounts[b.borrowerName] = (borrowerCounts[b.borrowerName] || 0) + 1;
                }
            });
            // Count from history
            u.returnHistory.forEach(b => {
                if (b.borrowerName) {
                    borrowerCounts[b.borrowerName] = (borrowerCounts[b.borrowerName] || 0) + 1;
                }
            });
        });

        const topBorrowers = Object.entries(borrowerCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);

        // Filter out deleted users for the management list
        const activeUsers = users.filter(u => !u.isDeleted);

        res.render("admin", { users: activeUsers, topBorrowers: topBorrowers, maintenanceMode: maintenanceMode });
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

// Library Page
app.get("/library", async (req, res) => {
    const searchQuery = req.query.search;
    const sortOption = req.query.sort;
    const filterOption = req.query.filter;
    const message = req.query.message;
    const error = req.query.error;
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

        let sort = {};
        if (sortOption === 'price_asc') {
            sort = { bookPrice: 1 };
        } else if (sortOption === 'price_desc') {
            sort = { bookPrice: -1 };
        }

        const books = await Book.find(query).sort(sort);
        res.render("library", { 
            data: books, 
            searchQuery: searchQuery || '', 
            sortOption: sortOption || '',
            filterOption: filterOption || 'all',
            message: message || null,
            error: error || null
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
app.post("/add", async (req, res) => {
    const newBook = new Book({
        bookName: req.body.bookName,
        bookAuthor: req.body.bookAuthor,
        bookPages: req.body.bookPages,
        bookPrice: req.body.bookPrice,
        bookPublication: req.body.bookPublication,
        bookState: "Available",
        quantity: 10,
        issued: 0
    });
    await newBook.save();
    res.redirect("/library");
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

// Start Server
app.listen(PORT, () => {
    console.log(`App is running on port :${PORT}`);
});