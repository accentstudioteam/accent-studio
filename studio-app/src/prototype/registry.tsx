import type { ScreenDef } from "./types";
import {
  ApplyIntro,
  ApplyForm,
  ApplyVoiceSample,
  ApplyMotivation,
  ApplySubmitted,
} from "@/screens/apply";
import {
  InterviewInvite,
  InterviewBrief,
  InterviewTasks,
  InterviewSubmitted,
  DecisionAccepted,
  DecisionWaitlisted,
} from "@/screens/interview";
import {
  OnbWelcome,
  OnbProfile,
  KycIdIntro,
  KycIdCapture,
  KycSelfie,
  KycReview,
  DocsOverview,
  DocSign,
  DocsComplete,
  PayoutSetup,
  TrainingIntro,
  OnbComplete,
} from "@/screens/onboarding";

/**
 * Ordered screen registry. `nav.next()` walks this list; the index
 * groups by phase. Milestone 1 covers Apply -> Interview -> Onboarding.
 * Game / Economy / Account screens are added in Milestone 2.
 */
export const SCREENS: ScreenDef[] = [
  // --- Apply ---
  { id: "apply-intro", title: "Apply · intro", phase: "Apply", Component: ApplyIntro },
  { id: "apply-form", title: "Apply · your voice", phase: "Apply", Component: ApplyForm },
  { id: "apply-voice", title: "Apply · voice sample", phase: "Apply", Component: ApplyVoiceSample },
  { id: "apply-motivation", title: "Apply · questions", phase: "Apply", Component: ApplyMotivation },
  { id: "apply-submitted", title: "Apply · submitted", phase: "Apply", Component: ApplySubmitted },

  // --- Interview ---
  { id: "interview-invite", title: "Interview · invite", phase: "Interview", Component: InterviewInvite },
  { id: "interview-brief", title: "Interview · brief", phase: "Interview", Component: InterviewBrief },
  { id: "interview-tasks", title: "Interview · tasks", phase: "Interview", Component: InterviewTasks },
  { id: "interview-submitted", title: "Interview · submitted", phase: "Interview", Component: InterviewSubmitted },
  { id: "decision-accepted", title: "Decision · accepted", phase: "Interview", Component: DecisionAccepted },
  { id: "decision-waitlisted", title: "Decision · waitlisted", phase: "Interview", Component: DecisionWaitlisted },

  // --- Onboarding / compliance ---
  { id: "onb-welcome", title: "Onboarding · welcome", phase: "Onboarding", Component: OnbWelcome },
  { id: "onb-profile", title: "Onboarding · profile", phase: "Onboarding", Component: OnbProfile },
  { id: "kyc-id-intro", title: "KYC · ID intro", phase: "Onboarding", Component: KycIdIntro },
  { id: "kyc-id-capture", title: "KYC · ID capture", phase: "Onboarding", Component: KycIdCapture },
  { id: "kyc-selfie", title: "KYC · selfie", phase: "Onboarding", Component: KycSelfie },
  { id: "kyc-review", title: "KYC · review", phase: "Onboarding", Component: KycReview },
  { id: "docs-overview", title: "Docs · overview", phase: "Onboarding", Component: DocsOverview },
  { id: "doc-sign", title: "Docs · sign", phase: "Onboarding", Component: DocSign },
  { id: "docs-complete", title: "Docs · complete", phase: "Onboarding", Component: DocsComplete },
  { id: "payout-setup", title: "Onboarding · payouts", phase: "Onboarding", Component: PayoutSetup },
  { id: "training-intro", title: "Onboarding · training", phase: "Onboarding", Component: TrainingIntro },
  { id: "onb-complete", title: "Onboarding · complete", phase: "Onboarding", Component: OnbComplete },
];
