import accessControl from './access-control.json';
import common from './common.json';
import dashboard from './dashboard.json';
import th from './th.json';

export default {
  ...common,
  ...dashboard,
  ...accessControl,
  ...th,
};
