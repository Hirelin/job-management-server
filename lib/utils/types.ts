export type User = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  recruiter: null | {
    id: string;
    name: string;
    organization: string;
    phone: string;
    address: string;
    position: string;
  };
};

export type ServerSessionReturn =
  | {
      data: User;
      status: "authenticated";
      error: null;
    }
  | {
      data: null;
      status: "unauthenticated";
      error: string | null;
    };

// event = {
//   "type": event_type,
//   "timestamp": datetime.utcnow().isoformat(),
//   "session": {
//       "session_id": "04a97469-b626-4a4e-9f00-11ffe6b73a7d",
//       "job_id": "dca590e4-8707-4cc5-acef-f24375ea19db"
//       },
//   "data": {
//       "title": "Frontend developer",
//       "description": "Looking for a frontend developer with React experience.",
//   },

export type Event = {
  type: string;
  timestamp: string; // ISO format
  session: {
    session_id: string;
    job_id?: string; // Optional, if applicable
    application_id?: string; // Optional, if applicable
  };
  data: Record<string, any>; // Flexible data structure
  file: string | null;
};
