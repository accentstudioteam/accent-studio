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
import {
  Home,
  VolleyRecord,
  VolleySubmitted,
  VolleyRate,
  ArenaLobby,
  ArenaScene,
  ArenaResult,
  CuttingRoomQueue,
  CuttingRoomVerify,
  CuttingRoomAlign,
} from "@/screens/game";
import { Wallet, Cashout, CashoutConfirm, Ledger } from "@/screens/economy";
import {
  Profile,
  Progression,
  MyDocuments,
  ConsentCenter,
  DataPrivacy,
  DataCopyRequest,
  DataErasure,
} from "@/screens/account";
import {
  FoundryOverview,
  CorpusBuilder,
  SessionDetail,
  PipelineStages,
  ManifestView,
  PackageBuild,
  ConsentAudit,
  DeliveryReceipt,
  EngineRoom,
} from "@/screens/delivery";

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

  // --- Game ---
  { id: "home", title: "Home · dashboard", phase: "Game", Component: Home },
  { id: "volley-record", title: "Volley · record", phase: "Game", Component: VolleyRecord },
  { id: "volley-submitted", title: "Volley · submitted", phase: "Game", Component: VolleySubmitted },
  { id: "volley-rate", title: "Volley · rate a take", phase: "Game", Component: VolleyRate },
  { id: "arena-lobby", title: "Arena · matchmaking", phase: "Game", Component: ArenaLobby },
  { id: "arena-scene", title: "Arena · live scene", phase: "Game", Component: ArenaScene },
  { id: "arena-result", title: "Arena · result", phase: "Game", Component: ArenaResult },
  { id: "cutting-room-queue", title: "Cutting Room · queue", phase: "Game", Component: CuttingRoomQueue },
  { id: "cutting-room-verify", title: "Cutting Room · fix text", phase: "Game", Component: CuttingRoomVerify },
  { id: "cutting-room-align", title: "Cutting Room · match words", phase: "Game", Component: CuttingRoomAlign },

  // --- Economy ---
  { id: "wallet", title: "Wallet", phase: "Economy", Component: Wallet },
  { id: "cashout", title: "Cash out", phase: "Economy", Component: Cashout },
  { id: "cashout-confirm", title: "Cashout · confirmed", phase: "Economy", Component: CashoutConfirm },
  { id: "ledger", title: "Transaction history", phase: "Economy", Component: Ledger },

  // --- Account ---
  { id: "profile", title: "Profile", phase: "Account", Component: Profile },
  { id: "progression", title: "Progression", phase: "Account", Component: Progression },
  { id: "my-documents", title: "My documents", phase: "Account", Component: MyDocuments },
  { id: "consent-center", title: "Consent center", phase: "Account", Component: ConsentCenter },
  { id: "data-privacy", title: "Data & privacy", phase: "Account", Component: DataPrivacy },
  { id: "data-copy", title: "Request a copy of my data", phase: "Account", Component: DataCopyRequest },
  { id: "data-erasure", title: "Delete identity data", phase: "Account", Component: DataErasure },

  // --- Delivery / Foundry (internal ops, investor-facing) ---
  { id: "foundry-overview", title: "Foundry · overview", phase: "Delivery", Component: FoundryOverview },
  { id: "corpus-builder", title: "Foundry · corpora", phase: "Delivery", Component: CorpusBuilder },
  { id: "session-detail", title: "Foundry · session", phase: "Delivery", Component: SessionDetail },
  { id: "pipeline-stages", title: "Foundry · pipeline", phase: "Delivery", Component: PipelineStages },
  { id: "manifest-view", title: "Foundry · manifest", phase: "Delivery", Component: ManifestView },
  { id: "package-build", title: "Foundry · package", phase: "Delivery", Component: PackageBuild },
  { id: "consent-audit", title: "Foundry · consent audit", phase: "Delivery", Component: ConsentAudit },
  { id: "delivery-receipt", title: "Foundry · deliveries", phase: "Delivery", Component: DeliveryReceipt },
  { id: "engine-room", title: "Foundry · engine room", phase: "Delivery", Component: EngineRoom },
];
