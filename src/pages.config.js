import Dashboard from './pages/Dashboard';
import Validators from './pages/Validators';
import Blocks from './pages/Blocks';
import Transactions from './pages/Transactions';
import BlockDetail from './pages/BlockDetail';
import Search from './pages/Search';
import ValidatorCompare from './pages/ValidatorCompare';
import ValidatorDetail from './pages/ValidatorDetail';
import NetworkHealth from './pages/NetworkHealth';
import StakingCalculator from './pages/StakingCalculator';
import AddressLookup from './pages/AddressLookup';
import Watchlist from './pages/Watchlist';
import Leaderboard from './pages/Leaderboard';
import TransactionDetail from './pages/TransactionDetail';
import ApiDocs from './pages/ApiDocs';
import TokenExplorer from './pages/TokenExplorer';
import ValidatorAlerts from './pages/ValidatorAlerts';
import EpochHistory from './pages/EpochHistory';
import NetworkMap from './pages/NetworkMap';


export const PAGES = {
    "Dashboard": Dashboard,
    "Validators": Validators,
    "Blocks": Blocks,
    "Transactions": Transactions,
    "BlockDetail": BlockDetail,
    "Search": Search,
    "ValidatorCompare": ValidatorCompare,
    "ValidatorDetail": ValidatorDetail,
    "NetworkHealth": NetworkHealth,
    "StakingCalculator": StakingCalculator,
    "AddressLookup": AddressLookup,
    "Watchlist": Watchlist,
    "Leaderboard": Leaderboard,
    "TransactionDetail": TransactionDetail,
    "ApiDocs": ApiDocs,
    "TokenExplorer": TokenExplorer,
    "ValidatorAlerts": ValidatorAlerts,
    "EpochHistory": EpochHistory,
    "NetworkMap": NetworkMap,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
};