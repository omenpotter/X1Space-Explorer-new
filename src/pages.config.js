import Dashboard from './pages/Dashboard';
import Validators from './pages/Validators';
import Blocks from './pages/Blocks';
import Transactions from './pages/Transactions';
import BlockDetail from './pages/BlockDetail';
import Search from './pages/Search';
import ValidatorCompare from './pages/ValidatorCompare';
import ValidatorDetail from './pages/ValidatorDetail';


export const PAGES = {
    "Dashboard": Dashboard,
    "Validators": Validators,
    "Blocks": Blocks,
    "Transactions": Transactions,
    "BlockDetail": BlockDetail,
    "Search": Search,
    "ValidatorCompare": ValidatorCompare,
    "ValidatorDetail": ValidatorDetail,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
};