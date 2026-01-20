// src/pages/LPExplorer.jsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  getLPStats,
  getLPTokens,
  getTopLPHolders,
  getLPEvents,
  getLPEventStats,
  formatLPAmount,
  formatEventTime
} from '@/services/lpApi';
import { 
  DropletIcon, 
  TrendingUpIcon, 
  UsersIcon, 
  ActivityIcon,
  SearchIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ExternalLinkIcon
} from 'lucide-react';

const LPExplorer = () => {
  const [stats, setStats] = useState(null);
  const [lpTokens, setLpTokens] = useState([]);
  const [topHolders, setTopHolders] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const [eventStats, setEventStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [statsData, tokensData, holdersData, eventsData, eventStatsData] = await Promise.all([
        getLPStats(),
        getLPTokens(50),
        getTopLPHolders(30),
        getLPEvents({ limit: 20 }),
        getLPEventStats()
      ]);

      setStats(statsData.stats);
      setLpTokens(tokensData.tokens);
      setTopHolders(holdersData.holders);
      setRecentEvents(eventsData.events);
      setEventStats(eventStatsData.stats);
    } catch (error) {
      console.error('Failed to load LP data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTokens = lpTokens.filter(token =>
    token.lp_mint.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col space-y-2">
        <h1 className="text-4xl font-bold">Liquidity Pools</h1>
        <p className="text-muted-foreground">
          Explore XDEX liquidity pools, holders, and activity
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pools</CardTitle>
            <DropletIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_pools || 0}</div>
            <p className="text-xs text-muted-foreground">Active liquidity pools</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Holders</CardTitle>
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_holders || 0}</div>
            <p className="text-xs text-muted-foreground">Unique LP holders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total LP Supply</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total_lp_supply ? formatLPAmount(stats.total_lp_supply, 0) : '0'}
            </div>
            <p className="text-xs text-muted-foreground">LP tokens issued</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">LP Events</CardTitle>
            <ActivityIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{eventStats?.total_events || 0}</div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">{eventStats?.add_count || 0} adds</span> · {' '}
              <span className="text-red-600">{eventStats?.remove_count || 0} removes</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="pools" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pools">Pools</TabsTrigger>
          <TabsTrigger value="holders">Top Holders</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
        </TabsList>

        {/* Pools Tab */}
        <TabsContent value="pools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Liquidity Pools</CardTitle>
              <CardDescription>Top pools by holder count</CardDescription>
              <div className="flex items-center space-x-2 pt-4">
                <SearchIcon className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by LP mint address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-sm"
                />
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>LP Token</TableHead>
                    <TableHead className="text-right">Holders</TableHead>
                    <TableHead className="text-right">Total Supply</TableHead>
                    <TableHead className="text-right">Decimals</TableHead>
                    <TableHead className="text-right">Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTokens.map((token) => (
                    <TableRow key={token.lp_mint}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="truncate max-w-[200px]" title={token.lp_mint}>
                            {token.lp_mint.slice(0, 8)}...{token.lp_mint.slice(-8)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => window.open(`https://xen.pub/address/${token.lp_mint}`, '_blank')}
                          >
                            <ExternalLinkIcon className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{token.holder_count}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatLPAmount(token.total_supply)}
                      </TableCell>
                      <TableCell className="text-right">{token.decimals}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {new Date(token.updated_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Holders Tab */}
        <TabsContent value="holders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top LP Holders</CardTitle>
              <CardDescription>Users with most LP positions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rank</TableHead>
                    <TableHead>Holder Address</TableHead>
                    <TableHead className="text-right">Pool Count</TableHead>
                    <TableHead className="text-right">Total LP Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topHolders.map((holder, index) => (
                    <TableRow key={holder.holder_address}>
                      <TableCell>
                        <Badge variant={index < 3 ? "default" : "outline"}>
                          #{index + 1}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center space-x-2">
                          <span className="truncate max-w-[300px]" title={holder.holder_address}>
                            {holder.holder_address.slice(0, 8)}...{holder.holder_address.slice(-8)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => window.open(`https://xen.pub/address/${holder.holder_address}`, '_blank')}
                          >
                            <ExternalLinkIcon className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{holder.pool_count} pools</Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatLPAmount(holder.total_lp_balance, 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recent Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent LP Events</CardTitle>
              <CardDescription>Latest add and remove liquidity transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>LP Token</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                    <TableHead>Tx</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentEvents.map((event) => (
                    <TableRow key={event.signature}>
                      <TableCell>
                        <Badge variant={event.event_type === 'add_liquidity' ? 'default' : 'destructive'}>
                          {event.event_type === 'add_liquidity' ? (
                            <><ArrowUpIcon className="h-3 w-3 mr-1" /> Add</>
                          ) : (
                            <><ArrowDownIcon className="h-3 w-3 mr-1" /> Remove</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {event.lp_mint.slice(0, 6)}...
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {event.user_address.slice(0, 6)}...
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {event.event_type === 'add_liquidity' ? '+' : '-'}
                        {formatLPAmount(event.lp_amount_change)}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatEventTime(event.block_time)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => window.open(`https://xen.pub/tx/${event.signature}`, '_blank')}
                        >
                          <ExternalLinkIcon className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {recentEvents.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No recent LP events found
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LPExplorer;
