import AddressLookup from './pages/AddressLookup';
import ApiDocs from './pages/ApiDocs';
import BlockDetail from './pages/BlockDetail';
import Blocks from './pages/Blocks';
import Home from './pages/Home';
import Leaderboard from './pages/Leaderboard';
import NetworkHealth from './pages/NetworkHealth';
import NetworkMap from './pages/NetworkMap';
import PortfolioTracker from './pages/PortfolioTracker';
import Search from './pages/Search';
import StakingCalculator from './pages/StakingCalculator';
import TransactionDetail from './pages/TransactionDetail';
import TransactionFlowPage from './pages/TransactionFlowPage';
import Transactions from './pages/Transactions';
import ValidatorAlerts from './pages/ValidatorAlerts';
import ValidatorCompare from './pages/ValidatorCompare';
import ValidatorDetail from './pages/ValidatorDetail';
import Validators from './pages/Validators';
import Watchlist from './pages/Watchlist';
import WhaleWatcher from './pages/WhaleWatcher';
import Dashboard from './pages/Dashboard';
import CustomDashboard from './pages/CustomDashboard';
import TokenExplorer from './pages/TokenExplorer';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AddressLookup": AddressLookup,
    "ApiDocs": ApiDocs,
    "BlockDetail": BlockDetail,
    "Blocks": Blocks,
    "Home": Home,
    "Leaderboard": Leaderboard,
    "NetworkHealth": NetworkHealth,
    "NetworkMap": NetworkMap,
    "PortfolioTracker": PortfolioTracker,
    "Search": Search,
    "StakingCalculator": StakingCalculator,
    "TransactionDetail": TransactionDetail,
    "TransactionFlowPage": TransactionFlowPage,
    "Transactions": Transactions,
    "ValidatorAlerts": ValidatorAlerts,
    "ValidatorCompare": ValidatorCompare,
    "ValidatorDetail": ValidatorDetail,
    "Validators": Validators,
    "Watchlist": Watchlist,
    "WhaleWatcher": WhaleWatcher,
    "Dashboard": Dashboard,
    "CustomDashboard": CustomDashboard,
    "TokenExplorer": TokenExplorer,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};