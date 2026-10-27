import type { Claim, Comparison, Recording, TranscriptSegment } from "@/types";

/**
 * Fictional demonstration archive.
 *
 * Everything in this file is invented for product demonstration. The audio is
 * synthetic TTS, the narrators are fictional, and the claims are not historical
 * evidence. The UI and every export label these records as DEMO.
 */

const meeraSegments: TranscriptSegment[] = [
  {
    id: "demo-meera-seg-1",
    text: "माझी आजी नेहमी सांगायची की पहिला उत्सव महापुरानंतरच्या वर्षी, म्हणजे १९६२ मध्ये झाला.",
    translation:
      "My grandmother always said the first festival was held the year after the great flood, that is, in 1962.",
    startSeconds: 0,
    endSeconds: 9.839,
    speakerLabel: null,
  },
  {
    id: "demo-meera-seg-2",
    text: "ती म्हणायची की गावकऱ्यांनी निलावरी तलावाच्या काठी दगडी बांध बांधला आणि त्यानंतर देवीचे आभार मानण्यासाठी उत्सव सुरू केला.",
    translation:
      "She said the villagers built a stone embankment at the edge of Nilavari Lake, and afterwards started the festival to thank the goddess.",
    startSeconds: 10.289,
    endSeconds: 21.076,
    speakerLabel: null,
  },
  {
    id: "demo-meera-seg-3",
    text: "उत्सव कार्तिक पौर्णिमेला होतो, आणि त्या दिवशी संध्याकाळी तलावात दिवे सोडले जातात.",
    translation:
      "The festival takes place on the Kartik full moon, and that evening lamps are set afloat on the lake.",
    startSeconds: 21.526,
    endSeconds: 29.038,
    speakerLabel: null,
  },
  {
    id: "demo-meera-seg-4",
    text: "मला आठवतं की आजी म्हणायची, 'पाणी आलं तेव्हा सगळं शेत गेलं, पण आम्ही हार मानली नाही.'",
    translation:
      "I remember grandmother would say, 'When the water came, all the fields were lost, but we did not give up.'",
    startSeconds: 29.488,
    endSeconds: 38.113,
    speakerLabel: null,
  },
];

const rukminiSegments: TranscriptSegment[] = [
  {
    id: "demo-rukmini-seg-1",
    text: "ನನ್ನ ಅಜ್ಜಿ ಹೇಳುತ್ತಿದ್ದರು, ಹಳೆಯ ಹನುಮಂತ ದೇವಸ್ಥಾನ ಮತ್ತೆ ಕಟ್ಟಿದ ಮೇಲೆ ಈ ಜಾತ್ರೆ ಶುರುವಾಯಿತು ಅಂತ.",
    translation:
      "My grandmother used to say that this festival started after the old Hanuman temple was rebuilt.",
    startSeconds: 0,
    endSeconds: 8.512,
    speakerLabel: null,
  },
  {
    id: "demo-rukmini-seg-2",
    text: "ಆಗ ಹೊಸ ರಸ್ತೆ ನಮ್ಮ ಊರಿಗೆ ಬಂದಿತ್ತು. ಅದು ಎಪ್ಪತ್ತರ ದಶಕದಲ್ಲಿ ಅಂತ ನನಗೆ ನೆನಪು.",
    translation:
      "The new road had come to our village then. I remember it was in the seventies.",
    startSeconds: 8.962,
    endSeconds: 16.243,
    speakerLabel: null,
  },
  {
    id: "demo-rukmini-seg-3",
    text: "ಜಾತ್ರೆಯಲ್ಲಿ ದೋಣಿ ಮೆರವಣಿಗೆ ಇರುತ್ತದೆ, ಮತ್ತು ಮಣ್ಣಿನ ದೀಪಗಳನ್ನು ನೀರಿಗೆ ಬಿಡುತ್ತಾರೆ.",
    translation:
      "There is a boat procession in the festival, and clay lamps are set into the water.",
    startSeconds: 16.693,
    endSeconds: 23.857,
    speakerLabel: null,
  },
  {
    id: "demo-rukmini-seg-4",
    text: "ನಾನು ಚಿಕ್ಕವಳಿದ್ದಾಗ ಅಜ್ಜಿ ಜೊತೆ ದೋಣಿಯಲ್ಲಿ ಕುಳಿತು ದೀಪಗಳನ್ನು ಬಿಟ್ಟಿದ್ದೇನೆ.",
    translation:
      "When I was small, I sat in the boat with my grandmother and set lamps afloat.",
    startSeconds: 24.307,
    endSeconds: 30.963,
    speakerLabel: null,
  },
];

const arjunSegments: TranscriptSegment[] = [
  {
    id: "demo-arjun-seg-1",
    text: "मेरे दादाजी कहते थे कि यह मेला सूखे के बाद शुरू हुआ था, बाढ़ के बाद नहीं।",
    translation:
      "My grandfather used to say that this fair started after a drought, not after a flood.",
    startSeconds: 0,
    endSeconds: 7.116,
    speakerLabel: null,
  },
  {
    id: "demo-arjun-seg-2",
    text: "उनके मुताबिक़ गाँव के मुखिया ने सबको बुलाकर कहा था कि अब हर साल नदी किनारे मेला होगा।",
    translation:
      "According to him, the village headman called everyone and said that from now on there would be a fair by the river every year.",
    startSeconds: 7.566,
    endSeconds: 15.263,
    speakerLabel: null,
  },
  {
    id: "demo-arjun-seg-3",
    text: "मेला लगभग सत्तर साल पहले शुरू हुआ, ऐसा दादाजी बताते थे।",
    translation: "Grandfather said the fair started about seventy years ago.",
    startSeconds: 15.713,
    endSeconds: 21.774,
    speakerLabel: null,
  },
  {
    id: "demo-arjun-seg-4",
    text: "मेले में नाव सजाई जाती है और मिट्टी के दीये पानी में छोड़े जाते हैं।",
    translation:
      "In the fair, a boat is decorated and clay lamps are set afloat in the water.",
    startSeconds: 22.224,
    endSeconds: 28.462,
    speakerLabel: null,
  },
  {
    id: "demo-arjun-seg-5",
    text: "मुझे ठीक से याद नहीं कि मुखिया का नाम भास्कर था या नहीं।",
    translation:
      "I don't remember exactly whether the headman's name was Bhaskar or not.",
    startSeconds: 28.912,
    endSeconds: 33.873,
    speakerLabel: null,
  },
];

const demoDate = "2026-10-01T09:00:00.000Z";

export const demoRecordings: Recording[] = [
  {
    id: "demo-rec-meera",
    title: "The year after the flood",
    speaker: "Meera Kulkarni",
    language: "Marathi",
    languageCode: "mr-IN",
    place: "Nandipur, Maharashtra (fictional)",
    period: "Recorded 2024 · memories of the 1960s",
    topics: ["festival origin", "flood", "stone embankment", "Kartik"],
    notes:
      "Fictional demonstration record. Marathi transcript with English translations. Synthetic TTS audio, not a real oral history.",
    createdAt: demoDate,
    updatedAt: demoDate,
    source: "audio",
    transcriptSource: "demo",
    transcriptSegments: meeraSegments,
    audio: {
      fileName: "meera.mp3",
      mimeType: "audio/mpeg",
      size: 458650,
      durationSeconds: 38.114785,
    },
    isDemo: true,
    consentAt: null,
    transcriptEditedAt: null,
  },
  {
    id: "demo-rec-rukmini",
    title: "When the new road came",
    speaker: "Rukmini Rao",
    language: "Kannada",
    languageCode: "kn-IN",
    place: "Nandipur, Karnataka (fictional)",
    period: "Recorded 2023 · memories of the 1970s",
    topics: ["temple", "boat ritual", "festival origin", "new road"],
    notes:
      "Fictional demonstration record. Kannada transcript with English translations. Synthetic TTS audio, not a real oral history.",
    createdAt: "2026-10-02T09:00:00.000Z",
    updatedAt: "2026-10-02T09:00:00.000Z",
    source: "audio",
    transcriptSource: "demo",
    transcriptSegments: rukminiSegments,
    audio: {
      fileName: "rukmini.mp3",
      mimeType: "audio/mpeg",
      size: 372760,
      durationSeconds: 30.963175,
    },
    isDemo: true,
    consentAt: null,
    transcriptEditedAt: null,
  },
  {
    id: "demo-rec-arjun",
    title: "The headman's promise",
    speaker: "Arjun Deshpande",
    language: "Hindi",
    languageCode: "hi-IN",
    place: "Nandipur, Madhya Pradesh (fictional)",
    period: "Recorded 2022 · memories of the 1950s",
    topics: ["drought", "headman", "festival origin", "boat ritual"],
    notes:
      "Fictional demonstration record. Hindi transcript with English translations. Synthetic TTS audio, not a real oral history.",
    createdAt: "2026-10-03T09:00:00.000Z",
    updatedAt: "2026-10-03T09:00:00.000Z",
    source: "audio",
    transcriptSource: "demo",
    transcriptSegments: arjunSegments,
    audio: {
      fileName: "arjun.mp3",
      mimeType: "audio/mpeg",
      size: 407555,
      durationSeconds: 33.872653,
    },
    isDemo: true,
    consentAt: null,
    transcriptEditedAt: null,
  },
];

function demoClaim(input: {
  id: string;
  recordingId: string;
  claimText: string;
  claimType: Claim["claimType"];
  entities: Claim["entities"];
  timePeriod: Claim["timePeriod"];
  quote: string;
  segmentId: string;
  startSeconds: number;
  endSeconds: number;
  uncertainty: Claim["uncertainty"];
  basis?: Claim["basis"];
  interpretationNote?: string | null;
}): Claim {
  return {
    id: input.id,
    recordingId: input.recordingId,
    claimText: input.claimText,
    claimType: input.claimType,
    entities: input.entities,
    timePeriod: input.timePeriod,
    evidence: {
      quote: input.quote,
      startSeconds: input.startSeconds,
      endSeconds: input.endSeconds,
      timestampSource: "segment",
      segmentId: input.segmentId,
      segmentIds: [input.segmentId],
    },
    basis: input.basis ?? "explicit",
    uncertainty: input.uncertainty,
    speakerWording: input.quote,
    interpretationNote: input.interpretationNote ?? null,
    evidenceStatus: "valid",
    researcherNotes: "",
    createdAt: demoDate,
    updatedAt: demoDate,
    isDemo: true,
    model: "demo-dataset",
  };
}

export const demoClaims: Claim[] = [
  demoClaim({
    id: "demo-claim-meera-1",
    recordingId: "demo-rec-meera",
    claimText: "The first Nilavari Lake Festival was held in 1962, the year after a major flood.",
    claimType: "origin",
    entities: [
      { name: "Nilavari Lake Festival", type: "tradition" },
      { name: "1962", type: "date" },
      { name: "the great flood", type: "event" },
    ],
    timePeriod: {
      start: "1962",
      end: null,
      originalExpression: "महापुरानंतरच्या वर्षी, म्हणजे १९६२ मध्ये",
    },
    quote: meeraSegments[0]!.text,
    segmentId: "demo-meera-seg-1",
    startSeconds: 0,
    endSeconds: 9.839,
    uncertainty: "low",
  }),
  demoClaim({
    id: "demo-claim-meera-2",
    recordingId: "demo-rec-meera",
    claimText:
      "Villagers built a stone embankment at Nilavari Lake after the flood and started the festival to thank the goddess.",
    claimType: "origin",
    entities: [
      { name: "villagers", type: "other" },
      { name: "Nilavari Lake", type: "place" },
      { name: "stone embankment", type: "object" },
      { name: "the goddess", type: "other" },
    ],
    timePeriod: { start: null, end: null, originalExpression: "त्यानंतर" },
    quote: meeraSegments[1]!.text,
    segmentId: "demo-meera-seg-2",
    startSeconds: 10.289,
    endSeconds: 21.076,
    uncertainty: "medium",
  }),
  demoClaim({
    id: "demo-claim-meera-3",
    recordingId: "demo-rec-meera",
    claimText:
      "The festival is held on the Kartik full moon and includes floating lamps on the lake.",
    claimType: "tradition",
    entities: [
      { name: "Kartik full moon", type: "date" },
      { name: "lamps", type: "object" },
      { name: "Nilavari Lake", type: "place" },
    ],
    timePeriod: { start: null, end: null, originalExpression: "कार्तिक पौर्णिमेला" },
    quote: meeraSegments[2]!.text,
    segmentId: "demo-meera-seg-3",
    startSeconds: 21.526,
    endSeconds: 29.038,
    uncertainty: "low",
  }),
  demoClaim({
    id: "demo-claim-meera-4",
    recordingId: "demo-rec-meera",
    claimText: "The flood destroyed the fields, but the villagers did not give up.",
    claimType: "event",
    entities: [
      { name: "flood", type: "event" },
      { name: "fields", type: "place" },
      { name: "villagers", type: "other" },
    ],
    timePeriod: { start: null, end: null, originalExpression: null },
    quote: meeraSegments[3]!.text,
    segmentId: "demo-meera-seg-4",
    startSeconds: 29.488,
    endSeconds: 38.113,
    uncertainty: "medium",
  }),
  demoClaim({
    id: "demo-claim-rukmini-1",
    recordingId: "demo-rec-rukmini",
    claimText: "The festival began after the old Hanuman temple was rebuilt.",
    claimType: "origin",
    entities: [
      { name: "Hanuman temple", type: "place" },
      { name: "festival", type: "tradition" },
    ],
    timePeriod: { start: null, end: null, originalExpression: "ಮತ್ತೆ ಕಟ್ಟಿದ ಮೇಲೆ" },
    quote: rukminiSegments[0]!.text,
    segmentId: "demo-rukmini-seg-1",
    startSeconds: 0,
    endSeconds: 8.512,
    uncertainty: "medium",
  }),
  demoClaim({
    id: "demo-claim-rukmini-2",
    recordingId: "demo-rec-rukmini",
    claimText: "The new road reached the village around the 1970s.",
    claimType: "period",
    entities: [
      { name: "new road", type: "object" },
      { name: "1970s", type: "date" },
    ],
    timePeriod: { start: null, end: null, originalExpression: "ಎಪ್ಪತ್ತರ ದಶಕದಲ್ಲಿ" },
    quote: rukminiSegments[1]!.text,
    segmentId: "demo-rukmini-seg-2",
    startSeconds: 8.962,
    endSeconds: 16.243,
    uncertainty: "medium",
  }),
  demoClaim({
    id: "demo-claim-rukmini-3",
    recordingId: "demo-rec-rukmini",
    claimText: "The festival includes a boat procession and clay lamps set into the water.",
    claimType: "tradition",
    entities: [
      { name: "boat procession", type: "tradition" },
      { name: "clay lamps", type: "object" },
    ],
    timePeriod: { start: null, end: null, originalExpression: null },
    quote: rukminiSegments[2]!.text,
    segmentId: "demo-rukmini-seg-3",
    startSeconds: 16.693,
    endSeconds: 23.857,
    uncertainty: "low",
  }),
  demoClaim({
    id: "demo-claim-rukmini-4",
    recordingId: "demo-rec-rukmini",
    claimText:
      "The narrator remembers sitting in a boat with her grandmother and setting lamps afloat as a child.",
    claimType: "practice",
    entities: [
      { name: "narrator", type: "person" },
      { name: "grandmother", type: "person" },
      { name: "boat", type: "object" },
      { name: "lamps", type: "object" },
    ],
    timePeriod: { start: null, end: null, originalExpression: "ಚಿಕ್ಕವಳಿದ್ದಾಗ" },
    quote: rukminiSegments[3]!.text,
    segmentId: "demo-rukmini-seg-4",
    startSeconds: 24.307,
    endSeconds: 30.963,
    uncertainty: "low",
  }),
  demoClaim({
    id: "demo-claim-arjun-1",
    recordingId: "demo-rec-arjun",
    claimText: "The festival began after a drought, not after a flood.",
    claimType: "origin",
    entities: [
      { name: "festival", type: "tradition" },
      { name: "drought", type: "event" },
      { name: "flood", type: "event" },
    ],
    timePeriod: { start: null, end: null, originalExpression: null },
    quote: arjunSegments[0]!.text,
    segmentId: "demo-arjun-seg-1",
    startSeconds: 0,
    endSeconds: 7.116,
    uncertainty: "medium",
  }),
  demoClaim({
    id: "demo-claim-arjun-2",
    recordingId: "demo-rec-arjun",
    claimText: "The village headman called everyone and declared an annual fair by the river.",
    claimType: "origin",
    entities: [
      { name: "village headman", type: "person" },
      { name: "river", type: "place" },
      { name: "annual fair", type: "tradition" },
    ],
    timePeriod: { start: null, end: null, originalExpression: null },
    quote: arjunSegments[1]!.text,
    segmentId: "demo-arjun-seg-2",
    startSeconds: 7.566,
    endSeconds: 15.263,
    uncertainty: "medium",
  }),
  demoClaim({
    id: "demo-claim-arjun-3",
    recordingId: "demo-rec-arjun",
    claimText:
      "According to the narrator's grandfather, the fair began about seventy years before the recording.",
    claimType: "period",
    entities: [
      { name: "grandfather", type: "person" },
      { name: "fair", type: "tradition" },
    ],
    timePeriod: { start: null, end: null, originalExpression: "लगभग सत्तर साल पहले" },
    quote: arjunSegments[2]!.text,
    segmentId: "demo-arjun-seg-3",
    startSeconds: 15.713,
    endSeconds: 21.774,
    uncertainty: "medium",
  }),
  demoClaim({
    id: "demo-claim-arjun-4",
    recordingId: "demo-rec-arjun",
    claimText: "The fair includes a decorated boat and clay lamps set afloat.",
    claimType: "tradition",
    entities: [
      { name: "boat", type: "object" },
      { name: "clay lamps", type: "object" },
    ],
    timePeriod: { start: null, end: null, originalExpression: null },
    quote: arjunSegments[3]!.text,
    segmentId: "demo-arjun-seg-4",
    startSeconds: 22.224,
    endSeconds: 28.462,
    uncertainty: "low",
  }),
  demoClaim({
    id: "demo-claim-arjun-5",
    recordingId: "demo-rec-arjun",
    claimText: "The narrator is unsure whether the headman's name was Bhaskar.",
    claimType: "person",
    entities: [
      { name: "headman", type: "person" },
      { name: "Bhaskar", type: "person" },
    ],
    timePeriod: { start: null, end: null, originalExpression: null },
    quote: arjunSegments[4]!.text,
    segmentId: "demo-arjun-seg-5",
    startSeconds: 28.912,
    endSeconds: 33.873,
    uncertainty: "high",
  }),
];

export const demoComparison: Comparison = {
  id: "demo-comparison-nilavari",
  title: "Origin stories of the Nilavari Lake Festival",
  summary:
    "Three fictional narrators describe the Nilavari Lake Festival. Their accounts of its origin differ, while they share a ritual of boats and floating lamps. The comparison does not decide which origin is correct.",
  recordingIds: ["demo-rec-meera", "demo-rec-rukmini", "demo-rec-arjun"],
  createdAt: "2026-10-04T09:00:00.000Z",
  model: "demo-dataset",
  isDemo: true,
  disclaimer:
    "DEMONSTRATION DATA — fictional accounts created for the EchoLedger interface, with synthetic audio. Not historical evidence. Relationship labels are illustrative and provisional. Agreement is not proof of truth; a discrepancy is not necessarily a contradiction; missing evidence is not evidence of absence.",
  warnings: [
    "This comparison uses fictional demonstration records. Do not cite it as history.",
  ],
  groups: [
    {
      id: "demo-group-origin",
      topic: "How the festival began",
      relationship: "conflicting",
      rationale:
        "Meera remembers the festival beginning after a flood in 1962; Rukmini after the old Hanuman temple was rebuilt; Arjun after a drought. The accounts offer incompatible origin stories. The comparison does not decide which narrator is correct.",
      claimIds: ["demo-claim-meera-1", "demo-claim-rukmini-1", "demo-claim-arjun-1"],
      confidence: "medium",
    },
    {
      id: "demo-group-timing",
      topic: "When did the festival begin?",
      relationship: "uncertain",
      rationale:
        "Rukmini remembers the new road arriving in the 1970s. Arjun's grandfather said the fair began about seventy years before the 2022 recording. These are relative memories, not directly comparable precise dates, and the evidence is insufficient to resolve them.",
      claimIds: ["demo-claim-rukmini-2", "demo-claim-arjun-3"],
      confidence: "low",
    },
    {
      id: "demo-group-ritual",
      topic: "Boats and floating lamps",
      relationship: "corroborating",
      rationale:
        "All three narrators describe lamps set afloat; Rukmini and Arjun also describe a boat. Their accounts broadly agree on the ritual. Agreement does not establish the ritual's origin or historical truth.",
      claimIds: [
        "demo-claim-meera-3",
        "demo-claim-rukmini-3",
        "demo-claim-arjun-4",
        "demo-claim-rukmini-4",
      ],
      confidence: "high",
    },
    {
      id: "demo-group-collective",
      topic: "Villagers, a headman and a promise",
      relationship: "related",
      rationale:
        "Meera describes villagers building an embankment; Arjun describes a headman calling the village together. Both describe collective action around the festival, but they are not the same account.",
      claimIds: ["demo-claim-meera-2", "demo-claim-arjun-2"],
      confidence: "medium",
    },
    {
      id: "demo-group-unique-flood",
      topic: "The flood destroyed the fields",
      relationship: "unique",
      rationale:
        "Only Meera describes the flood destroying the fields and the villagers' response. No other selected recording contains a comparable account.",
      claimIds: ["demo-claim-meera-4"],
      confidence: "medium",
    },
    {
      id: "demo-group-unique-name",
      topic: "The headman's name",
      relationship: "unique",
      rationale:
        "Only Arjun mentions uncertainty about whether the headman's name was Bhaskar.",
      claimIds: ["demo-claim-arjun-5"],
      confidence: "high",
    },
  ],
  ungroupedClaimIds: [],
};
