import { type ActionFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { useEffect, useState } from "react";

import { Bot, UserRound } from "lucide-react";
import OpenAI from "openai";


export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  
  const history = JSON.parse(formData.get("history") as string);
  const input = formData.get("input")?.toString() ?? "";

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content:
          'Word of the Day\nWe want to teach students a new word everyday. This will be done by conversing with our AI tutor. There are distinct stages in the conversation to ensure that the user has understood the new word.\nStage 1 - Introduction and Explanation\nIn this stage, the AI tutor will explain the word to the student. Student can clarify by asking doubts and the AI should respond. The AI can ask if the student has understood, and if the student responds in an affirmative, then the conversation can proceed to the next stage.\nStage 2 - MCQ\nThe academics team will define a set of MCQ questions to be asked to the student to gauge their understanding. AI should ask three questions in total, and the student should answer atleast two correctly to proceed to the next stage. If the students answers 2/3 incorrectly, then move back to Stage 1. The student can answer the question by saying the right answer like "Option A is correct" or "First option", or directly saying the actual answer.\nOnce all the stages are done, there should be some confirmation to the user and the activity should end.\n\nThe output should be one of the following json:\n{\n  "stage": "introduction_and_explanation",\n  "message": "Today\'s word is <word>. It means <definition>.",\n  "prompt": "Do you understand the meaning of <word>? Please let me know if you have any questions."\n}\n{\n  "stage": "mcq",\n  "message": "That\'s (in)correct. Let\'s try another question.", // optional, if the previous question was correct or incorrect.\n  "question": "<question>", // e.g., Which of the following options best describes the meaning of <word>?\n  "choices": ["option_a", "option_b", "option_c"],\n  "correctAnswerIndex": x, // e.g., 1\n}\n{\n  "stage": "confidence_check",\n  "message": "Congratulations! You now know how to use <word> properly. Would you like some extra practice or additional information?",\n}\n{\n  "stage": "end"\n}',
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...history.map((entry: any) => {
        if (typeof entry === "string") {
          return {
            role: "user",
            content: entry,
          };
        }

        return {
          role: "assistant",
          content: JSON.stringify(entry),
        };
      }),
      {
        role: "user",
        content: input,
      },
    ],
    temperature: 1,
    max_tokens: 256,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });

  const message = response.choices[0].message.content ?? "{}";

  return {
    history: [...history, input, JSON.parse(message)],
  };
}

export default function Index() {
  const actionData = useActionData<typeof action>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [history, setHistory] = useState<
    (
      | string
      | {
          stage: "introduction_and_explanation";
          message: string;
          prompt: string;
        }
      | {
          stage: "mcq";
          message?: string;
          question: string;
          choices: string[];
          correctAnswerIndex: number;
        }
      | {
          stage: "confidence_check";
          message: string;
        }
      | {
          stage: "end";
        }
    )[]
  >([]);

  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  useEffect(() => {
    if (actionData) {
      setHistory(actionData.history);

      const container = document.getElementById("container");

      if (container) {
        container.scrollTo(0, container.scrollHeight);
      }

      const form = document.getElementById("chat-form");

      if (form) {
        (form as HTMLFormElement).reset();
      }
    }
  }, [actionData]);

  return (
    <div
      id="container"
      className="bg-white p-8 rounded-3xl shadow-2xl flex-1 relative flex flex-col items-stretch justify-start overflow-hidden"
    >
      <div className="w-full max-w-4xl px-4 mx-auto flex flex-col items-stretch justify-start flex-1 overflow-auto">
        {history.map((entry) => 
        {
          const key = JSON.stringify(entry)
          if (typeof entry === "string") {
            return <Message key={key} message={entry} isUser={true} />;
          }

          if (entry.stage === "introduction_and_explanation") {
            return (
              <>
                <Message key={key} message={entry.message} isUser={false} />
                <Message key={key} message={entry.prompt} isUser={false} />
              </>
            );
          }

          if (entry.stage === "mcq") {
            return (
              <>
                {entry.message ? (
                  <Message key={key} message={entry.message} isUser={false} />
                ) : null}
                <Message
                  key={key}
                  message={
                    <div className="flex flex-col gap-2">
                      <strong>{entry.question}</strong>
                      <ol className="">
                        {entry.choices.map((choice, index) => (
                          <li key={index} className="list-decimal list-inside">
                            {choice}
                          </li>
                        ))}
                      </ol>
                    </div>
                  }
                  isUser={false}
                />
              </>
            );
          }

          if (entry.stage === "confidence_check") {
            return (
              <Message key={key} message={entry.message} isUser={false} />
            );
          }

          return null;
        })}
      </div>

      <Form
        id="chat-form"
        method="post"
        className="shadow-2xl mt-8 w-[min(80%,640px)] mx-auto flex flex-row items-center justify-between gap-2 px-6 py-2 rounded-xl bg-teal-200"
        reloadDocument={false}
      >
        <fieldset className="contents" disabled={isSubmitting}>
          <input
            className="hidden"
            name="history"
            type="hidden"
            value={JSON.stringify(history)}
          />

          <input
            className="flex-1 py-2 bg-transparent font-bold focus:outline-none placeholder:text-black/50 text-teal-900 disabled:opacity-50"
            placeholder={
              history.length === 0
                ? "What word do you want to learn? Eg. Tedious, Sacrosanct, Unfathomable, etc."
                : "Message..."
            }
            autoComplete="off"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            name="input"
            type="text"
            required
          />
          <button
            type="submit"
            className="px-6 py-2 grid place-content-center rounded-xl bg-teal-950 text-white font-bold disabled:opacity-50 disabled:cursor-wait"
          >
            Send
          </button>
        </fieldset>
      </Form>
    </div>
  );
}

type MessageProps = {
  message: React.ReactNode;
  isUser: boolean;
};

function Message({ message, isUser }: MessageProps) {
  return (
    <div
      className={[
        "w-[min(80%,640px)] flex items-center justify-start gap-4 py-4 border-b border-black/10",
        isUser ? "flex-row-reverse text-right ml-auto" : "flex-row",
      ].join(" ")}
    >
      {isUser ? (
        <UserRound size={32} className="rounded-md bg-blue-200 text-blue-900" />
      ) : (
        <Bot size={32} className="rounded-md bg-teal-200 text-teal-900" />
      )}

      <p
        className={[
          "text-lg/snug font-medium flex-1",
          isUser ? "text-blue-900" : "",
        ].join(" ")}
      >
        {message}
      </p>
    </div>
  );
}
