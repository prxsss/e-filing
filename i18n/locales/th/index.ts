import accessControl from './access-control.json';
import adminRequests from './admin-requests.json';
import auth from './auth.json';
import common from './common.json';
import dashboard from './dashboard.json';
import delegations from './delegations.json';
import departments from './departments.json';
import errors from './errors.json';
import faculties from './faculties.json';
import signerSignedHistory from './signer-signed-history.json';
import signerToSign from './signer-to-sign.json';
import studentMyRequests from './student-my-requests.json';
import studentNewRequest from './student-new-request.json';
import templates from './templates.json';
import th from './th.json';
import users from './users.json';

export default {
  ...adminRequests,
  ...common,
  ...dashboard,
  ...studentMyRequests,
  ...studentNewRequest,
  ...signerToSign,
  ...signerSignedHistory,
  ...accessControl,
  ...auth,
  ...faculties,
  ...templates,
  ...departments,
  ...delegations,
  ...errors,
  ...users,
  ...th,
};
