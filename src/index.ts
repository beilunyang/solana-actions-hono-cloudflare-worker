import { Hono, HonoRequest } from 'hono'
import { ActionGetResponse, ActionPostRequest, createPostResponse } from '@solana/actions'
import { clusterApiUrl, Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { HTTPException } from 'hono/http-exception';
import { cors } from 'hono/cors';
import { Buffer } from 'node:buffer';

self.Buffer = Buffer;

type Bindings = {
  SOLANA_RPC: string
}

const app = new Hono<{ Bindings: Bindings }>()

const validateQueryParams = (req: HonoRequest) => {
  let toPubKey;
  let amount;

  try {
    toPubKey = new PublicKey(req.query('to')!);
  } catch (err) {
    throw new Error("Invalid query param: to");
  }

  if (req.query('amount') != null) {
    amount = parseFloat(req.query('amount')!);
    if (amount <= 0) {
      throw new Error('Invalid query param: amount');
    }
  }

  return {
    amount,
    toPubKey,
  };
}


app.use(cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Content-Encoding', 'Accept-Encoding'],
}));

app.get('/donate', (ctx) => {
  const {
    toPubKey,
  } = validateQueryParams(ctx.req);

  const toAddress = toPubKey.toBase58();

  const baseURL = new URL(
    `/donate?to=${toAddress}`,
    ctx.req.url,
  ).toString();

  const payload: ActionGetResponse = {
    title: `SOL Donation`,
    icon: 'https://pic.otaku.ren/20240707/AQAD9b4xG3BDUFR9.jpg',
    description: `Donate SOL to ${toAddress}`,
    label: 'Donate',
    links: {
      actions: [
        {
          label: 'Donate 1 SOL',
          href: `${baseURL}&amount=1`,
        },
        {
          label: 'Donate 5 SOL',
          href: `${baseURL}&amount=5`,
        },
        {
          label: 'Donate 10 SOL',
          href: `${baseURL}&amount=10`,
        },
        {
          label: 'Donate SOL',
          href: `${baseURL}&amount={amount}`,
          parameters: [
            {
              name: "amount",
              label: "Enter the amount of SOL to donate",
              required: true,
            },
          ],
        } 
      ],
    },
  };

  return ctx.json(payload);
});

app.post('/donate', async (ctx) => {
  const {
    toPubKey,
    amount = 0,
  } = validateQueryParams(ctx.req);
  const body: ActionPostRequest = await ctx.req.json();
  
  let account: PublicKey;

  try {
    account = new PublicKey(body.account);
  } catch (err) {
    throw new Error('Invalid body param: account');
  }

  const connection = new Connection(
    ctx.env.SOLANA_RPC || clusterApiUrl('devnet'),
  );

  const latestBlockhash = await connection.getLatestBlockhash();

  const transaction = new Transaction(latestBlockhash);

  transaction.add(
    SystemProgram.transfer({
      fromPubkey: account,
      toPubkey: toPubKey,
      lamports: amount * LAMPORTS_PER_SOL,
    }),
  );

  transaction.feePayer = account;

  const payload = await createPostResponse({
    fields: {
      transaction,
      message: `Transfer ${amount} SOL to ${toPubKey.toBase58()}`,
    },
  })

  return ctx.json(payload);
});

app.onError((err) => {
  console.error(err);
  return new HTTPException(400, { message: err.message }).getResponse();
});

export default app
