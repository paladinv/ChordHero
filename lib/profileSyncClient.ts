import { createRevisionSyncClient, type RevisionSyncClient, type RevisionSyncEnvelope } from "./songSyncClient";
import type { StudentCloudState } from "./studentProfile";

export type StudentProfileSyncClient = RevisionSyncClient<StudentCloudState>;
export type StudentProfileSyncEnvelope = RevisionSyncEnvelope<StudentCloudState>;

export function createStudentProfileSyncClient(baseURL: string, libraryID: string, accountID: string): StudentProfileSyncClient {
  return createRevisionSyncClient<StudentCloudState>(baseURL, libraryID, accountID);
}
