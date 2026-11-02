# Specialized Study Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Identity Integrity**: Every created document (`UserProfile`, `Institution`, `ClassRoom`, `WorkPlan`, `LessonItem`, `QuestionItem`, `Assessment`, `AssessmentAttempt`, `MasteryRecord`) must bind its creator/owner UID field (`uid`, `adminUid`, `createdByUid`, `authorId`, `studentId`) strictly to `request.auth.uid` or verified Platform Owner (`asilbeknuraliyev43@gmail.com`).
2. **Email Verification**: All standard write operations require `request.auth.token.email_verified == true`.
3. **Path Variable Hardening**: Every document ID path variable must satisfy `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).
4. **Strict Keys & Size Limits**: Every string field has an explicit `.size() <= MAX` bound, and every array field has an explicit `.size() <= MAX` bound with element type checking.
5. **Terminal State Locking**: Once an `AssessmentAttempt` is created with `status == 'completed'`, it cannot be modified by students.
6. **No Blanket List Reads**: Every `allow list` rule enforces ownership or relational constraints on `resource.data` without `get()`/`exists()` inside `list`.
7. **Official 19-Class Structure**: Only the 19 official Specialized Study classes (`5a1, 5a2, 6a1, 6a2, 7a1, 7a2, 8a1, 8a2, 9a1, 9a2, 10a1, 10a2, 11a1, 11a2` and `7t, 8t, 9t, 10t, 11t`) are active; `5t` and `6t` are strictly forbidden.

## 2. The "Dirty Dozen" Payloads
1. **Unverified Email Spoof**: Write attempt where `request.auth.token.email_verified == false`.
2. **Shadow Field Injection**: Updating `UserProfile` with an undeclared `isAdmin: true` field.
3. **Role Self-Escalation**: Updating `UserProfile.role` from `'student'` to `'admin'` by a non-admin user.
4. **ID Poisoning**: Creating a document with a 500-character or special-character document ID.
5. **Identity Spoofing on Attempt**: Student A submitting an `AssessmentAttempt` with `studentId` set to Student B's UID.
6. **Terminal Attempt Mutation**: Student attempting to `update` a completed `AssessmentAttempt` to change `scorePercent` to `100`.
7. **Denial of Wallet String Overflow**: Submitting a `QuestionItem` with a 50,000-character `prompt`.
8. **Unbounded Array Poisoning**: Submitting an `Assessment` with 500 items in `questionIds` or non-string first element.
9. **Cross-Tenant Institution Hijack**: User attempting to update an `Institution` where `existing().adminUid != request.auth.uid`.
10. **Invalid Class Code Creation**: Attempting to create `5t` or `6t` in `classes`.
11. **Unauthorized WorkPlan Creation**: A student attempting to create a `WorkPlan` or `LessonItem`.
12. **Blanket List Scraping**: Listing `assessment_attempts` without filtering by `studentId == request.auth.uid`.
