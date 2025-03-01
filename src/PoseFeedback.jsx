import React, { useRef, useEffect, useState } from "react";
import { Pose, POSE_CONNECTIONS } from "@mediapipe/pose";
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

const PoseFeedback = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [exercise, setExercise] = useState("bicep_curl");
  const [feedback, setFeedback] = useState("");
  const [angle, setAngle] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [completedRepetition, setCompletedRepetition] = useState(false);
  const startWristXRef = useRef(null); // Use ref instead of global variable

  useEffect(() => {
    window.PoseFeedback = {
      setExercise: (workout) => {
        setExercise(workout);
        console.log("Workout set from React Native:", workout);
      },
    };
    return () => {
      delete window.PoseFeedback;
    };
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const workoutFromUrl = urlParams.get("workout");
    if (workoutFromUrl) {
      setExercise(decodeURIComponent(workoutFromUrl));
      console.log("Workout set from URL:", workoutFromUrl);
    }
  }, []);

  useEffect(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const pose = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      },
    });

    pose.setOptions({
      modelComplexity: 0,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults((results) => {
      const canvasCtx = canvasRef.current.getContext("2d");
      canvasCtx.save();
      canvasCtx.clearRect(
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height
      );
      canvasCtx.drawImage(
        results.image,
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height
      );

      if (results.poseLandmarks) {
        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
          color: "#00FF00",
          lineWidth: 4,
        });
        drawLandmarks(canvasCtx, results.poseLandmarks, {
          color: "#FF0000",
          lineWidth: 2,
        });

        const landmarks = results.poseLandmarks;
        const {
          feedback,
          correct,
          angle: calculatedAngle,
        } = getExerciseFeedback(landmarks, exercise);

        setFeedback(feedback);
        setAngle(calculatedAngle.toFixed(1));

        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(
            JSON.stringify({ feedback, correctCount, angle: calculatedAngle })
          );
        }

        if (correct && !completedRepetition) {
          setCorrectCount((prevCount) => prevCount + 1);
          setCompletedRepetition(true);
        } else if (!correct) {
          setCompletedRepetition(false);
        }

        canvasCtx.fillStyle = "#FF0000";
        canvasCtx.font = "20px Arial";
        canvasCtx.fillText(`Exercise: ${exercise}`, 10, 30);
        canvasCtx.fillText(`Feedback: ${feedback}`, 10, 60);
        canvasCtx.fillText(`Angle: ${calculatedAngle.toFixed(1)}°`, 10, 90);
        canvasCtx.fillText(`Correct Count: ${correctCount}`, 10, 120);
      }

      canvasCtx.restore();
    });

    let lastProcessedTime = 0;
    const throttleMs = 100;
    const camera = new Camera(videoRef.current, {
      onFrame: async () => {
        const now = Date.now();
        if (now - lastProcessedTime >= throttleMs && videoRef.current) {
          await pose.send({ image: videoRef.current });
          lastProcessedTime = now;
        }
      },
      width: 640,
      height: 480,
    });

    camera.start().catch((err) => {
      console.error("Camera failed to start:", err);
    });

    return () => {
      camera.stop();
      pose.close();
    };
  }, [exercise]);

  const calculateAngle = (a, b, c) => {
    const radians =
      Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) {
      angle = 360.0 - angle;
    }
    return angle;
  };

  const isLandmarkVisible = (landmark) => landmark.visibility > 0.5;

  const getExerciseFeedback = (landmarks, exercise) => {
    let angle = 0;
    let feedback = "";
    let correct = false;

    switch (exercise) {
      case "bicep_curl":
        const shoulder = landmarks[11]; // LEFT_SHOULDER
        const elbow = landmarks[13]; // LEFT_ELBOW
        const wrist = landmarks[15]; // LEFT_WRIST
        angle = calculateAngle(shoulder, elbow, wrist);
        if (angle < 20) {
          feedback = "Lower your arm to engage biceps fully.";
        } else if (angle > 160) {
          feedback = "Raise your arm more to complete the curl.";
        } else {
          feedback = "Good form!";
          correct = true;
        }
        break;

      case "squat":
        const hip = landmarks[23]; // LEFT_HIP
        const knee = landmarks[25]; // LEFT_KNEE
        const ankle = landmarks[27]; // LEFT_ANKLE
        angle = calculateAngle(hip, knee, ankle);
        if (angle > 170) {
          feedback = "Lower down for a full squat.";
        } else if (angle < 90) {
          feedback = "You're going too low!";
        } else {
          feedback = "Good squat form!";
          correct = true;
        }
        break;

      case "plank":
        const shoulderPlank = landmarks[11]; // LEFT_SHOULDER
        const hipPlank = landmarks[23]; // LEFT_HIP
        const anklePlank = landmarks[27]; // LEFT_ANKLE
        angle = calculateAngle(shoulderPlank, hipPlank, anklePlank);
        if (angle < 160) {
          feedback = "Raise your hips to straighten your body.";
        } else if (angle > 175) {
          feedback = "Good plank position!";
          correct = true;
        } else {
          feedback = "Engage core for a stable plank.";
        }
        break;

      case "shoulder_press": {
        const shoulder = landmarks[11]; // LEFT_SHOULDER
        const elbow = landmarks[13]; // LEFT_ELBOW
        const wrist = landmarks[15]; // LEFT_WRIST
        const hip = landmarks[23]; // LEFT_HIP
        const knee = landmarks[25]; // LEFT_KNEE

        if (
          isLandmarkVisible(shoulder) &&
          isLandmarkVisible(elbow) &&
          isLandmarkVisible(wrist) &&
          isLandmarkVisible(hip) &&
          isLandmarkVisible(knee)
        ) {
          const elbowAngle = calculateAngle(shoulder, elbow, wrist);
          angle = elbowAngle;

          if (elbowAngle > 90 && elbow.y > shoulder.y + 0.05) {
            feedback = "Raise your elbows to shoulder level before pressing.";
          } else if (Math.abs(wrist.x - elbow.x) > 0.1) {
            feedback =
              "Keep your wrists aligned with your elbows to prevent strain.";
          } else {
            if (startWristXRef.current === null) {
              startWristXRef.current = elbowAngle > 90 ? wrist.x : null;
            }
            if (
              startWristXRef.current !== null &&
              Math.abs(wrist.x - startWristXRef.current) > 0.15
            ) {
              feedback =
                "Press straight up without leaning forward or backward.";
            } else {
              const spineAngle = calculateAngle(hip, shoulder, knee);
              if (spineAngle < 160) {
                feedback = "Engage your core and avoid leaning back too much.";
              } else if (elbowAngle < 170) {
                feedback = "Fully extend your arms at the top.";
              } else if (elbowAngle > 190) {
                feedback = "Avoid locking out your elbows too aggressively.";
              } else {
                feedback = "Good shoulder press form!";
                correct = true;
              }
            }
          }
        } else {
          feedback = "Ensure body is fully visible to the camera.";
        }
        break;
      }

      case "lateral_raise": {
        const shoulder = landmarks[11]; // LEFT_SHOULDER
        const elbow = landmarks[13]; // LEFT_ELBOW
        const wrist = landmarks[15]; // LEFT_WRIST
        const hip = landmarks[23]; // LEFT_HIP
        const knee = landmarks[25]; // LEFT_KNEE
        const ear = landmarks[5]; // LEFT_EAR

        if (
          isLandmarkVisible(shoulder) &&
          isLandmarkVisible(elbow) &&
          isLandmarkVisible(wrist) &&
          isLandmarkVisible(hip) &&
          isLandmarkVisible(knee) &&
          isLandmarkVisible(ear)
        ) {
          const shoulderAngle = calculateAngle(hip, shoulder, elbow);
          const elbowAngle = calculateAngle(shoulder, elbow, wrist);
          angle = shoulderAngle;

          if (shoulderAngle > 100) {
            feedback =
              "Stop at shoulder height to avoid unnecessary shoulder joint strain.";
          } else if (Math.abs(shoulder.y - ear.y) < 0.15) {
            feedback =
              "Keep your shoulders relaxed and focus on lifting with your delts.";
          } else if (wrist.y < elbow.y - 0.05) {
            feedback =
              "Keep your elbows slightly higher than your wrists for proper deltoid activation.";
          } else {
            const torsoAngle = calculateAngle(hip, shoulder, knee);
            if (torsoAngle < 170) {
              feedback = "Engage your core and maintain an upright posture.";
            } else if (elbowAngle < 160) {
              feedback =
                "Keep a slight bend in your elbows, but don’t turn it into a press.";
            } else {
              feedback = "Good lateral raise form!";
              correct = true;
            }
          }
        } else {
          feedback = "Ensure body is fully visible to the camera.";
        }
        break;
      }

      default:
        feedback = "Unknown exercise";
    }

    return { angle, feedback, correct };
  };

  return (
    <div>
      <video ref={videoRef} style={{ display: "none" }} />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{ width: "100%", height: "auto" }}
      />
    </div>
  );
};

export default PoseFeedback;
