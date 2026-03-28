/* eslint-disable ts/consistent-type-definitions */
export interface KuAllCallback {
  'thainame': string;
  'first-name': string;
  'last-name': string;
  'preferred_username': string;

  'cn': string;
  'givenname': string;
  'surname': string;
  'thaiprename'?: string;
  'jobtype'?: string;
  'type-person': string;
  'position'?: string;
  'position-id'?: string;
  'campus': string;
  'faculty'?: string;
  'ku-faculty-en'?: string;
  'faculty-id'?: string;
  'department'?: string;
  'ku-department-en': string;
  'department-id'?: string;
  'idcode'?: string;
  'major-id'?: string;
  'advisor-id'?: string;
  'degree'?: string;
  'rfid'?: string;
  'mail'?: string;
  'google-mail'?: string;
  'office365-mail'?: string;
  'userprincipalname': string;
  'uid': string;
};

/**
 * 1 = Teacher
 * 2 = Staff
 * 3 = Student
 * 7 = Student (หลักสูตรศาสตร์แห่งแผ่นดิน)
 * 8 = Nondegree Student (ข้ามสถาบัน)
 */
export type AllowedTypePerson = '1' | '2' | '3' | '7' | '8';
