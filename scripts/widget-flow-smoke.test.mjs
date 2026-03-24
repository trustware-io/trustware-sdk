import assert from "node:assert/strict";
import test from "node:test";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TrustwareProvider, TrustwareWidget } from "../dist/index.mjs";

const baseConfig = {
  apiKey: "test_api_key",
  routes: {
    toChain: "base",
    toToken: "USDC",
  },
};

function renderWidget({
  config = {},
  initialStep = "home",
} = {}) {
  return renderToStaticMarkup(
    React.createElement(
      TrustwareProvider,
      {
        config: {
          ...baseConfig,
          ...config,
          routes: {
            ...baseConfig.routes,
            ...(config.routes ?? {}),
          },
        },
      },
      React.createElement(TrustwareWidget, {
        initialStep,
        showThemeToggle: false,
      })
    )
  );
}

test("renders the home flow shell", () => {
  const html = renderWidget();
  assert.match(html, /Deposit/);
  assert.match(html, /Pay with crypto/);
});

test("renders fixed-amount home flow without crashing", () => {
  const html = renderWidget({
    config: {
      routes: {
        options: {
          fixedFromAmount: "25",
        },
      },
    },
  });

  assert.match(html, /Deposit/);
});

test("renders select-token step shell", () => {
  const html = renderWidget({ initialStep: "select-token" });
  assert.match(html, /Select Token/);
});

test("renders crypto-pay step shell", () => {
  const html = renderWidget({ initialStep: "crypto-pay" });
  assert.match(html, /Confirm Deposit/);
});

test("renders processing step shell", () => {
  const html = renderWidget({ initialStep: "processing" });
  assert.match(html, /Processing/);
});

test("renders success step shell", () => {
  const html = renderWidget({ initialStep: "success" });
  assert.match(html, /Deposit Complete/);
});

test("renders error step shell", () => {
  const html = renderWidget({ initialStep: "error" });
  assert.match(html, /Something Went Wrong/);
});
