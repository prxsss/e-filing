import accessControl from './access-control.json';
import common from './common.json';
import dashboard from './dashboard.json';
import en from './en.json';

export default {
  ...common,
  ...dashboard,
  ...accessControl,
  ...en,
};
