import accessControl from './access-control.json';
import auth from './auth.json';
import common from './common.json';
import dashboard from './dashboard.json';
import departments from './departments.json';
import en from './en.json';
import errors from './errors.json';
import faculties from './faculties.json';
import users from './users.json';

export default {
  ...common,
  ...dashboard,
  ...accessControl,
  ...auth,
  ...faculties,
  ...departments,
  ...errors,
  ...users,
  ...en,
};
