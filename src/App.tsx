import { AptosClient } from 'aptos'
import { getRpcUrl } from './config'
import {
  useQuery,
  QueryClient,
  QueryClientProvider,
} from 'react-query'

const queryClient = new QueryClient()

type AptosGasPrice = {
  fast: number;
  standard: number;
  slow: number;
}

type UseAptosGasPriceOptions = {
  refetchInterval?: number;
}

function useAptosGasPrice(opts: UseAptosGasPriceOptions = {}): AptosGasPrice | undefined {
  const query = useQuery(['aptos', 'estimated-gas-price'], async () => {
    const client = new AptosClient(getRpcUrl())
    return client.estimateGasPrice()
  }, {
    refetchOnMount: false,
    refetchInterval: 500,
    ...opts,
  })

  if (query.data) {
    return {
      fast: query.data.prioritized_gas_estimate ?? 0,
      standard: query.data.gas_estimate,
      slow: query.data.deprioritized_gas_estimate ?? 0,
    }
  }

  return
}

function GasPrice() {
  const gasPrice = useAptosGasPrice()
  return (
    <code>{gasPrice ? JSON.stringify(gasPrice, null, 2) : 'loading ...'}</code>
  )
}

function App() {

  return (
    <QueryClientProvider client={queryClient}>
      <div>
        <h1>Aptos Gas</h1>
        <GasPrice />
        <p className="text-muted"><small>rpc url: {getRpcUrl()}</small></p>
      </div>
    </QueryClientProvider>
  )
}

export default App
