//the user is a director of football. in this scene the user is in a job interview. 
//the interview module will determine the user's attributes and profile. 
//the chairman will ask the user questions, the user will answer them and the profile will be populated based on his answers. 
//first they will fill out a form with basic details while they wait in the lobby
//next they will be called in an answer some multiple choice questions
//football history, their style, their preferences, their skills and their areas of weakness.


// Define the interface for the user's profile
interface Profile {
    name: string;
    age: number;
    nationality: string;
    // Add more attributes as needed
}

// Define the interface for the interview questions
interface Question {
    question: string;
    choices: string[];
}

// Define the interview module
class InterviewModule {
    private profile: Profile;
    private questions: Question[];

    constructor() {
        this.profile = {
            name: '',
            age: 0,
            nationality: '',
            // Initialize other attributes
        };

        this.questions = [
            // Add your multiple choice questions here
            {
                question: 'Question 1',
                choices: ['Choice 1', 'Choice 2', 'Choice 3'],
            },
            {
                question: 'Question 2',
                choices: ['Choice 1', 'Choice 2', 'Choice 3'],
            },
            // Add more questions
        ];
    }

    // Method to start the interview
    startInterview() {
        this.askBasicDetails();
    }

    // Method to ask basic details
    askBasicDetails() {
        // Code to display and capture basic details form
        // Update the profile object with the captured details
    }

    // Method to ask multiple choice questions
    askMultipleChoiceQuestions() {
        // Code to display and capture multiple choice questions
        // Update the profile object based on the user's answers
    }

    // Method to display the final profile
    displayProfile() {
        console.log('Profile:', this.profile);
    }
}

// Create an instance of the interview module and start the interview
const interview = new InterviewModule();
interview.startInterview();