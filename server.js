import express from 'express';
import cors from 'cors';
import { G4F } from 'g4f';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get } from "firebase/database";
import { v4 as uuidv4 } from 'uuid';
import sendEmail from './mail.js';
import './dotEnvConfig.js';

const firebaseConfig = {
    databaseURL: process.env.DATABASE_URL,
};

const g4f = new G4F();
const app = express();
const port = process.env.PORT;
const fireBaseApp = initializeApp(firebaseConfig);
const db = getDatabase(fireBaseApp);
app.use(express.json());
app.use(cors());

app.post('/chat', async (req, res) => {
    const { content, role, questions, experience, skills } = req.body;
    const options = {
        model: "gpt-4",
        debug: true,
        retry: {
            times: 3,
            condition: (text) => {
                const words = text.split(" ");
                return words.length > 10;
            }
        },
        output: (text) => {
            return text;
        }
    };
    const format = `[{
        "question": "generated question",
        "answer": "answer for the question",
        "weightage":"weightage for the question"
    },
    ........]`;
    const messages = [
        { role: "system", content: `Act as an ${role} in Tech Industry with 30+ years of experience, going to conduct an Crucial Technical Interview for your organisation, ok ?` },
        { role: "user", content: content + `Just give me only the array of objects with question, answer and weightage as keys with their respective values only in this format ${format}` },
    ];

    try {
        let text = await g4f.chatCompletion(messages, options);
        if (text.includes("```")) {
            text = text.replaceAll("```", '');
            text = text.replace("json", '');
        }
        const responseObject = JSON.parse(text);
        const responseString = JSON.stringify(responseObject);
        let q_id = uuidv4();
        const questionRef = ref(db, 'questions/' + q_id);
        set(questionRef, {
            q_id: q_id,
            role: role,
            experience: experience,
            no_of_questions: questions,
            skills: skills,
            questions: responseObject,
        })
        res.status(200).json({ response: responseString, q_id: q_id });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post('/aianalysis', async (req, res) => {
    try {
        const payload = req.body;
        const format = `{
            "comments": "Your comments on candidate's performance based on the scores."
        }`;

        const { questions_asked_to_the_candidate, scores_respectively } = payload;

        const totalScore = scores_respectively.reduce((acc, score) => {
            const parsedScore = parseInt(score.split(" ")[0]);
            return acc + parsedScore;
        }, 0);
        const maxPossibleScore = questions_asked_to_the_candidate.length * 4;
        const percentage = ((totalScore / maxPossibleScore) * 100).toFixed(2) + "%";

        const message = {
            role: "system",
            content: `
                As a Senior Technical Recruiter with 30+ years of experience in hiring people, your role is to carefully assess the candidate's technical skills and suitability for the position of ${payload.hiring_for}. 
                Please evaluate the candidate only based on their technical proficiency by the scores obtained comparing them with the company's job description and provide feedback accordingly.

                Candidate Information:
                - Name: ${payload.candidate_name}
                - Email: ${payload.candidate_email}
                - Experience: ${payload.candidates_experience} years
                - Skills: ${payload.candidates_skills.join(', ')}

                Questions Asked to the Candidate and their scores for the response by the interviewer:
                ${questions_asked_to_the_candidate.map((question, index) => `${question} - mark scored - ${scores_respectively[index]}`).join(", ")}

                Total Score:
                ${totalScore} out of ${maxPossibleScore}

                Percentage:
                ${percentage}

                Job Description by the organisation:
                ${payload.job_description}

                Above is the candidate's performance and the job description. 
                Please provide your evaluation only in the following JSON format:
                ${format}
            `
        };
        const options = {
            model: "gpt-4",
            debug: true,
            retry: {
                times: 3,
                condition: (text) => {
                    const words = text.split(" ");
                    return words.length > 10;
                }
            },
            output: (text) => {
                return text;
            }
        };
        const resp = await g4f.chatCompletion([message], options);
        if (resp.includes("```")) {
            resp = resp.replaceAll("```", '');
            resp = resp.replace("json", '');
        }
        const responseObject = JSON.parse(resp);
        const responseString = JSON.stringify(responseObject);
        res.status(200).json({ comments: responseObject.comments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.post('/publish', async (req, res) => {
    let data = req.body;
    let resp = writeUserData(data.user_id, data.q_id, data.name, data.email, data.total_marks, data.marks, data.percentage, data.publishWithAnswers, data.includeSelectionStatus, data.selectionStatus, data.companyName);
    if (resp) {
        let { message, subject } = getContent(data);
        let toAddress = [data.email];
        if (data.receiveResultsMail) {
            sendEmail({
                to: data.interviewerEmail,
                subject: 'Interview Results',
                message: `<!DOCTYPE html>
                <html lang="en">
                <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  body {
                    font-family: Arial, sans-serif;
                    background-color: #f5f5f5;
                    padding: 20px;
                  }
                  .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: #fff;
                    border-radius: 10px;
                    padding: 20px;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                  }
                  h1 {
                    color: #2a2392;
                    text-align: center;
                  }
                  p {
                    line-height: 1.6;
                  }
                  ul {
                    list-style-type: none;
                    padding: 0;
                  }
                  li {
                    margin-bottom: 10px;
                  }
                  .result-details {
                    background-color: #f9f9f9;
                    padding: 10px;
                    border-radius: 5px;
                  }
                  .result-details p {
                    margin: 0;
                  }
                  .total-score {
                    font-weight: bold;
                    color: #2a2392;
                  }
                  .percentage {
                    color: #2a2392;
                    font-size: 20px;
                    text-align: center;
                    margin-top: 20px;
                  }
                </style>
                </head>
                <body>
                <div class="container">
                  <h1>Interview Results</h1>
                  <p>Dear ${data.interviewerEmail},</p>
                  <p>Thank you for conducting the interview. Below are the results:</p>
                  <div class="result-details">
                    <ul>
                      <li>Name: ${data.name}</li>
                      <li>Email: ${data.email}</li>
                      <li class="total-score">Total Score: ${data.marks}/${data.total_marks}</li>
                    </ul>
                  </div>
                  <p class="percentage">Total Percentage: ${data.percentage}</p>
                </div>
                </body>
                </html>
                `
            }).then(response => {
                console.log("Email sent successfully to interviewer");
            })
                .catch(error => {
                    console.log("Failed to send email to interviewer:", error);
                });
        }
        sendEmail({
            to: toAddress,
            subject: subject,
            message: message
        })
            .then(response => {
                res.status(200).json({ "message": "Results published successfully!!", "success": true })
                console.log("Email sent successfully");
            })
            .catch(error => {
                res.status(200).json({ "message": "Error publishing results, kindly check the entered E-mail address.", "success": false })
                console.log("Failed to send email:", error);
            });
    }
})

app.get('/resources', async (req, res) => {
    try {
        const questionsRef = ref(db, 'questions');
        const snapshot = await get(questionsRef);
        const questionsData = [];
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                questionsData.push(childSnapshot.val());
            });
        }
        res.status(200).json(questionsData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

function writeUserData(userId, q_id, name, email, total_marks, marks, percentage, publishWithAnswers, includeSelectionStatus, selectionStatus, companyName) {
    const userRef = ref(db, 'users/' + userId);
    set(userRef, {
        u_id: userId,
        q_id: q_id,
        username: name,
        email: email,
        total_marks: total_marks,
        marks: marks,
        percentage: percentage,
        publishedWithAnswers: publishWithAnswers,
        includeSelectionStatus: includeSelectionStatus,
        selectionStatus: selectionStatus,
        companyName: companyName
    })
    return true;
}

function getContent(data) {
    let header;
    let main;
    let subject;
    let dom;
    if (data.publishWithAnswers) {
        let resData = data.questions.map((ele, index) => {
            return { ...ele, score: data.scores[index] };
        });

        if (data.includeSelectionStatus && data.selectionStatus === "selected") {
            subject = `Interview Results for ${data.role}`;
            header = "Congratulations!!";
            main = ` We are pleased to inform you that you have been selected to proceed to the next round of the interview process by <strong>${data.companyName}</strong>. Further details will be communicated to you shortly.`
        }
        else if (data.includeSelectionStatus && data.selectionStatus === "rejected") {
            subject = `Interview Results for ${data.role}`;
            header = "Interview Update";
            main = ` We regret to inform you that you have not been selected for further consideration in the interview process by <strong>${data.companyName}</strong>.`
        }
        else {
            subject = `Interview Update for ${data.role}`;
            header = "Interview Results";
            main = '';
        }
        dom = `<!DOCTYPE html>
            <html lang="en">
            <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
             body {
                font-family: Arial, sans-serif;
                background-color: #f5f5f5;
                padding: 20px;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #fff;
                border-radius: 10px;
                padding: 20px;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
              }
              h1 {
                color: #2a2392;
                text-align: center;
              }
              h3 {
                color: #2a2392;
              }
              p {
                line-height: 1.6;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 20px;
              }
              th, td {
                padding: 8px;
                border-bottom: 1px solid #ddd;
                text-align: left;
              }
              th {
                background-color: #f2f2f2;
              }
            </style>
            </head>
            <body>
            <div class="container">
              <h1>${header}</h1>
              <p>Dear <strong>${data.name}</strong>,</p>
              <p>Congratulations on completing the interview!.${main} Below are the details of your performance:</p>
              <table>
                <tr>
                  <th>Question</th>
                  <th>Answer</th>
                  <th>Score</th>
                </tr>`;
        resData.forEach(item => {
            dom += `
                <tr>
                  <td>${item.question}</td>
                  <td>${item.answer}</td>
                  <td>${item.score}</td>
                </tr>`;
        });
        dom += `
              </table>
              <p>Your Score: ${data.marks}</p>
              <p>Total Score: ${data.total_marks}</p>
              <p>Percentage: ${data.percentage}%</p>
              <p>Once again, well done!</p>
              <div class="message">
              <p>Thank you for your interest in ${data.companyName}.</p>
              <p>If you would like feedback on your interview performance or have any questions, please feel free to reach out to us. We are happy to provide any assistance or guidance.</p>
            </div>
            <strong><h3>Best regards,</h3>
            <h3>${data.companyName}.</h3></strong>
            </div>
            </body>
            </html>`;
    } else {
        if (data.includeSelectionStatus && data.selectionStatus === "selected") {
            subject = `Interview Results for ${data.role}`;
            header = "Congratulations!!";
            main = ` We are pleased to inform you that you have been selected to proceed to the next round of the interview process by <strong>${data.companyName}</strong>. Further details will be communicated to you shortly.`
        }
        else if (data.includeSelectionStatus && data.selectionStatus === "rejected") {
            subject = `Interview Results for ${data.role}`;
            header = "Interview Update";
            main = ` We regret to inform you that you have not been selected for further consideration in the interview process by <strong>${data.companyName}</strong>.`
        }
        else {
            subject = `Interview Update for ${data.role}`;
            header = "Interview Results";
            main = '';
        }
        dom = `<!DOCTYPE html>
            <html lang="en">
            <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
             body {
                font-family: Arial, sans-serif;
                background-color: #f5f5f5;
                padding: 20px;
              }
              .container {
                max-width: 600px;
                margin: 0 auto;
                background-color: #fff;
                border-radius: 10px;
                padding: 20px;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
              }
              h1 {
                color: #2a2392;
                text-align: center;
              }
              h3 {
                color: #2a2392;
              }
              p {
                line-height: 1.6;
              }
            </style>
            </head>
            <body>
            <div class="container">
              <h1>${header}</h1>
              <p>Dear <strong>${data.name}</strong>,</p>
              <p><strong>Congratulations!</strong> You have successfully completed the interview process with ${data.companyName}.${main}</p>       
              <p>Your Score: ${data.marks}</p>
              <p>Total Score: ${data.total_marks}</p>
              <p>Percentage: ${data.percentage}%</p>
              <p>Once again, well done!</p>
              <div class="message">
              <p>Thank you for your interest in ${data.companyName}.</p>
              <p>If you would like feedback on your interview performance or have any questions, please feel free to reach out to us. We are happy to provide any assistance or guidance.</p>
            </div>
            <strong><h3>Best regards,</h3>
            <h3>${data.companyName}.</h3></strong>
            </div>
            </body>
            </html>`;
    }
    return { subject, message: dom };
}


app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
