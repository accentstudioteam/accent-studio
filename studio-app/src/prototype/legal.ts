// Full working-draft legal text for the creator agreements shown in the
// signing flow. This is product content for Accent Studio's own platform.
// It is a thorough draft and must be reviewed by qualified counsel before
// production use; it is not itself legal advice.

export interface Clause {
  h: string;
  body: string;
}

export interface Agreement {
  id: string;
  name: string;
  version: string;
  summary: string;
  effective: string;
  sections: Clause[];
}

const IP_ASSIGNMENT: Agreement = {
  id: "ip-assignment",
  name: "Voice IP Assignment Agreement",
  version: "v1.2",
  effective: "2026-09-01",
  summary: "Assigns ownership of your recordings and roleplay to Accent Studio.",
  sections: [
    {
      h: "1 · Definitions",
      body:
        '"Company" means Accent Studio, Inc., a Delaware corporation, and its successors and assigns. "Creator", "you", and "your" mean the individual accepting this Agreement. "User Content" means all audio recordings, spoken performances, roleplay dialogue, transcripts, ratings, and related material you produce, submit, or generate through the platform. "Derived Materials" means any transcription, annotation, alignment, acoustic feature set, embedding, statistical model, machine-learning model, dataset, or other work created from or trained on User Content. "Platform" means the Accent Studio applications, websites, and services.',
    },
    {
      h: "2 · Grant of Ownership and Assignment",
      body:
        "You hereby irrevocably and unconditionally assign and transfer to the Company, in perpetuity and throughout the universe, all right, title, and interest of every kind in and to the User Content and all Derived Materials, including without limitation all copyrights, database rights, sui generis rights, neighboring rights, trade secrets, and all other intellectual property rights therein. This assignment is effective automatically upon your creation or submission of each item of User Content, with no further action required by either party.",
    },
    {
      h: "3 · Voice Likeness and Biometric Data Release",
      body:
        "You grant the Company a perpetual, worldwide, irrevocable, royalty-free, fully paid-up, transferable, and sub-licensable right and license to capture, record, store, reproduce, process, analyze, normalize, segment, and extract acoustic, phonetic, prosodic, and linguistic features from your voice, speech patterns, and vocal likeness. You acknowledge that voice recordings may constitute biometric data under applicable law, and you consent to their collection and processing for the purposes described in this Agreement, including the training and evaluation of speech-recognition, speech-synthesis, voice-conversion, translation, and conversational AI systems.",
    },
    {
      h: "4 · Scope of Permitted Processing",
      body:
        "Permitted processing includes, without limitation: transcription and re-transcription; diarization and speaker separation; timestamping and forced alignment; source-to-target linguistic alignment; emotion, sentiment, and code-switch labeling; noise and quality assessment; PII detection and redaction; dataset assembly and indexing; and the training, fine-tuning, evaluation, and productization of machine-learning models. Processing may be performed by the Company, its personnel, its service providers, and its enterprise customers under contract.",
    },
    {
      h: "5 · Commercialization and Sub-Licensing",
      body:
        "The Company may commercialize the User Content and Derived Materials in any manner and through any channel now known or later devised, including selling, licensing, leasing, sub-licensing, distributing, and creating derivative works, to any third party, including AI laboratories, enterprises, research institutions, and government-adjacent commercial entities, without any obligation of further notice, accounting, or compensation to you beyond the payment terms set out in Section 8.",
    },
    {
      h: "6 · Anonymization, De-identification and Privacy",
      body:
        "The Company operates on a zero-PII-by-design basis. Your legal identity, contact details, government identifiers, and payout information are stored in an isolated, encrypted identity vault that is logically and physically decoupled from your audio. Audio and Derived Materials are indexed only by non-identifying cryptographic identifiers. Spoken personal data detected in recordings is flagged and redacted or tokenized before any dataset is compiled for delivery. The Company processes personal data in accordance with the EU General Data Protection Regulation (GDPR), the Nigeria Data Protection Act (NDPA) and its regulations, the South African Protection of Personal Information Act (POPIA), and other applicable data-protection laws.",
    },
    {
      h: "7 · Data Security and Custody",
      body:
        "The Company maintains administrative, technical, and physical safeguards designed to protect User Content, including encryption in transit (TLS 1.3) and at rest (AES-256), role-based access control, IP allow-listing, write-once-read-many (WORM) storage for primary audio, and a SOC 2 Type II control program covering security, availability, and confidentiality. Enterprise delivery occurs through time-bound presigned URLs or secure data clean rooms so that raw audio need not leave a controlled environment.",
    },
    {
      h: "8 · Compensation and Accent Points",
      body:
        "In consideration of the rights granted, the Company will credit you Accent Points (AP) for verified contributions. AP are redeemable for monetary payout per the published rate schedule, expressed per Verified Hour of accepted audio and adjusted by a peer quality-assurance multiplier (Platinum 1.2x; Gold 1.0x; Silver 0.7x; Rejected 0x). Payouts are made through the payout rail you select, subject to the applicable minimum. AP have no cash value except as redeemed through the Platform, are non-transferable, and may be adjusted or reversed to correct error or fraud.",
    },
    {
      h: "9 · Independent Contractor Status",
      body:
        "You participate as an independent contractor and not as an employee, agent, partner, or joint venturer of the Company. Nothing in this Agreement creates an employment relationship. You are solely responsible for your own income taxes, social contributions, and regulatory filings in your jurisdiction, and you are not entitled to employee benefits.",
    },
    {
      h: "10 · Representations and Warranties",
      body:
        "You represent and warrant that: (a) you are at least 18 years of age; (b) the voice and performances you submit are your own and you have the full right to grant the rights in this Agreement; (c) your User Content does not infringe or misappropriate any third party's rights and does not contain unlawful content; (d) you will not submit the personal data of any other person without authorization; and (e) all information you provide, including identity and payout details, is true and accurate.",
    },
    {
      h: "11 · Prohibited Conduct and Anti-Fraud",
      body:
        "You will not submit synthetic, text-to-speech, voice-cloned, AI-generated, or pre-recorded third-party audio; impersonate another person; collude to manipulate pairing, ratings, or quality scores; use multiple or fraudulent accounts; or circumvent quality or integrity controls. The Company operates random review audits, gold-standard honeypot checks, synthetic-audio and voiceprint defenses, and a trust-score system. Breach of this Section may result in rejection of contributions, suspension or termination of your account, and forfeiture of unredeemed AP balances associated with the offending activity.",
    },
    {
      h: "12 · Data-Subject Rights and Revocation",
      body:
        "You retain the non-waivable statutory rights afforded by applicable data-protection law, including rights of access, rectification, portability, and erasure of identifiable data, and the right to withdraw consent. Withdrawal of consent operates prospectively: it halts future collection and processing of newly identifiable data but does not require recall of anonymized User Content or Derived Materials that can no longer be associated with you and that have already been incorporated into datasets or models delivered to third parties. Access and portability requests are fulfilled after identity verification, within the statutory period, with audio provided in a listening-quality format (studio master files are retained by the Company), and no more than once per ninety (90) days absent a legal requirement; each fulfilment is recorded in your consent record. A copy provided under this Section is for your records only and conveys no licence to reproduce, sell, publish, or sub-license User Content, which remains assigned to the Company under this Agreement. Erasure removes your identity vault and severs the association between you and your User Content; it does not require recall of pseudonymous User Content or Derived Materials already delivered under licence. Requests may be made through the in-app Data & Privacy controls or by contacting the Company's data protection contact.",
    },
    {
      h: "13 · Term and Termination",
      body:
        "This Agreement takes effect when you accept it and continues until terminated. You may stop contributing at any time and may close your account. The assignments, licenses, and releases granted with respect to User Content and Derived Materials created before termination are irrevocable and survive termination, as do Sections 2 through 8 and 10 through 18. Termination does not entitle you to reversal of contributions already accepted and delivered.",
    },
    {
      h: "14 · Confidentiality",
      body:
        "You will keep confidential any non-public information about the Platform, scenario decks, quality controls, honeypots, and anti-fraud mechanisms disclosed to you, and you will not use such information except to participate on the Platform.",
    },
    {
      h: "15 · Waiver of Moral Rights",
      body:
        "To the fullest extent permitted by applicable law, you waive, and agree not to assert, any moral rights or rights of attribution or integrity you may have in the User Content and Derived Materials, so that the Company may process, modify, and combine them as needed for the permitted purposes. Where such rights cannot be waived, you consent to all acts that would otherwise infringe them.",
    },
    {
      h: "16 · Disclaimers and Limitation of Liability",
      body:
        "The Platform is provided on an as-is and as-available basis. To the maximum extent permitted by law, the Company disclaims all implied warranties and will not be liable for indirect, incidental, special, consequential, or punitive damages. The Company's aggregate liability arising out of or relating to this Agreement will not exceed the total AP-redeemed payouts made to you in the twelve months preceding the event giving rise to the claim.",
    },
    {
      h: "17 · Governing Law and Dispute Resolution",
      body:
        "This Agreement is governed by the laws of the State of Delaware, United States, without regard to conflict-of-laws principles, except that mandatory data-protection and consumer-protection provisions of the jurisdiction in which you reside continue to apply where required. The parties will attempt in good faith to resolve disputes informally; unresolved disputes will be submitted to binding arbitration or to the courts of Delaware, as elected by the Company, except for claims that must be heard in your local courts under mandatory law.",
    },
    {
      h: "18 · Consent Record and Electronic Signature",
      body:
        "By ticking the acceptance boxes and activating the record or accept control, you provide an explicit electronic signature. The Company records a cryptographic consent event capturing your account identifier, the agreement version, a SHA-256 hash of the exact document accepted, a UTC timestamp, and a hash of your IP address. This record is retained as evidence of your acceptance and may be produced to demonstrate the chain of consent for delivered datasets.",
    },
    {
      h: "19 · Entire Agreement, Amendment, Severability",
      body:
        "This Agreement, together with the Platform Terms and Privacy Policy, is the entire agreement between you and the Company regarding its subject matter and supersedes prior understandings. Material amendments require re-consent before your next contribution; the version you accepted is recorded in your consent log. If any provision is held unenforceable, the remaining provisions continue in full force, and the unenforceable provision will be modified to the minimum extent necessary to make it enforceable.",
    },
  ],
};

const VOICE_RELEASE: Agreement = {
  id: "voice-release",
  name: "Voice Likeness & Audio Release",
  version: "v1.1",
  effective: "2026-09-01",
  summary: "Grants the right to process and train models on your voice.",
  sections: [
    {
      h: "1 · Release",
      body:
        "You grant the Company the perpetual, worldwide, royalty-free right to use, reproduce, process, and create derivative works from your recorded voice and vocal likeness for the development, training, evaluation, demonstration, and productization of AI systems, and to authorize its customers to do the same under contract.",
    },
    {
      h: "2 · No Guarantee of Use",
      body:
        "The Company is not obligated to use any particular recording. Non-use does not entitle you to additional compensation.",
    },
    {
      h: "3 · Synthetic Voice Outputs",
      body:
        "You acknowledge that models trained on aggregated data may generate synthetic speech. The Company will not knowingly market a synthetic voice presented as a specific, identifiable impersonation of you without a separate agreement.",
    },
    {
      h: "4 · Biometric Notice",
      body:
        "Voice data may be treated as biometric data under some laws. You consent to its collection and processing as described here and in the Voice IP Assignment Agreement, and you retain the statutory rights described therein.",
    },
  ],
};

const CONTRACTOR: Agreement = {
  id: "contractor",
  name: "Independent Contractor Agreement",
  version: "v1.0",
  effective: "2026-09-01",
  summary: "You play as an independent contractor, not an employee.",
  sections: [
    {
      h: "1 · Relationship",
      body:
        "You provide contributions as an independent contractor. You control the manner and means of your performance and are free to accept or decline any prompt or scene.",
    },
    {
      h: "2 · Taxes",
      body:
        "You are responsible for all taxes and statutory contributions on amounts you receive. The Company does not withhold taxes and may issue information reports where required by law.",
    },
    {
      h: "3 · No Benefits",
      body:
        "You are not entitled to employee benefits, leave, insurance, or similar entitlements.",
    },
    {
      h: "4 · Compliance",
      body:
        "You will comply with applicable laws in your jurisdiction while participating, including any local restrictions on independent work.",
    },
  ],
};

export const AGREEMENTS_FULL: Agreement[] = [IP_ASSIGNMENT, VOICE_RELEASE, CONTRACTOR];
