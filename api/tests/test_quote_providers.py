"""Tests for quote providers and the chain in core/data_sources/quotes.py."""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest
import requests

from core.data_sources.quotes import (
    BrapiProvider,
    StooqProvider,
    YahooProvider,
    get_quote_from_chain,
)


def _resp(json_data=None, text=None, status=200):
    r = MagicMock()
    r.status_code = status
    r.raise_for_status.return_value = None
    if status >= 400:
        r.raise_for_status.side_effect = requests.HTTPError(f"{status}")
    r.json.return_value = json_data
    r.text = text or ""
    return r


# ---------- BRAPI ----------

def test_brapi_happy_path(mocker):
    fake = _resp(json_data={
        "results": [{
            "regularMarketPrice": 45.67,
            "currency": "BRL",
            "regularMarketTime": "2026-05-09T04:18:16.000Z",
        }]
    })
    mocker.patch("core.data_sources.quotes.requests.get", return_value=fake)
    quote = BrapiProvider().fetch("PETR4", "BR")
    assert quote is not None
    assert quote.price == 45.67
    assert quote.currency == "BRL"
    assert quote.source == "brapi"
    assert quote.as_of.tzinfo is not None


def test_brapi_returns_none_for_us_market(mocker):
    spy = mocker.patch("core.data_sources.quotes.requests.get")
    assert BrapiProvider().fetch("AAPL", "US") is None
    spy.assert_not_called()  # Skip HTTP entirely for non-BR


def test_brapi_returns_none_on_timeout(mocker):
    mocker.patch("core.data_sources.quotes.requests.get", side_effect=requests.Timeout())
    assert BrapiProvider().fetch("PETR4", "BR") is None


def test_brapi_returns_none_on_empty_results(mocker):
    mocker.patch("core.data_sources.quotes.requests.get", return_value=_resp(json_data={"results": []}))
    assert BrapiProvider().fetch("PETR4", "BR") is None


def test_brapi_returns_none_on_404(mocker):
    mocker.patch("core.data_sources.quotes.requests.get", return_value=_resp(status=404))
    assert BrapiProvider().fetch("ZZZZ", "BR") is None


# ---------- Yahoo ----------

def test_yahoo_happy_path_us(mocker):
    fake = _resp(json_data={
        "chart": {"result": [{"meta": {
            "regularMarketPrice": 293.32,
            "currency": "USD",
            "regularMarketTime": 1778270402,
        }}]}
    })
    spy = mocker.patch("core.data_sources.quotes.requests.get", return_value=fake)
    quote = YahooProvider().fetch("AAPL", "US")
    assert quote is not None
    assert quote.price == 293.32
    assert quote.currency == "USD"
    assert quote.source == "yahoo"
    # US market does not append .SA
    assert "AAPL" in spy.call_args[0][0] and ".SA" not in spy.call_args[0][0]


def test_yahoo_appends_sa_suffix_for_br(mocker):
    fake = _resp(json_data={
        "chart": {"result": [{"meta": {
            "regularMarketPrice": 45.67,
            "currency": "BRL",
            "regularMarketTime": 1778270851,
        }}]}
    })
    spy = mocker.patch("core.data_sources.quotes.requests.get", return_value=fake)
    YahooProvider().fetch("PETR4", "BR")
    assert "PETR4.SA" in spy.call_args[0][0]


def test_yahoo_returns_none_when_result_empty(mocker):
    mocker.patch(
        "core.data_sources.quotes.requests.get",
        return_value=_resp(json_data={"chart": {"result": []}}),
    )
    assert YahooProvider().fetch("ZZZZ", "US") is None


def test_yahoo_returns_none_on_connection_error(mocker):
    mocker.patch("core.data_sources.quotes.requests.get", side_effect=requests.ConnectionError())
    assert YahooProvider().fetch("AAPL", "US") is None


# ---------- Stooq ----------

def test_stooq_happy_path_us(mocker):
    csv = "Symbol,Date,Time,Open,High,Low,Close,Volume\nAAPL.US,2026-05-08,22:00:21,290.01,294.76,290,293.32,52692761\n"
    mocker.patch("core.data_sources.quotes.requests.get", return_value=_resp(text=csv))
    quote = StooqProvider().fetch("AAPL", "US")
    assert quote is not None
    assert quote.price == 293.32
    assert quote.currency == "USD"
    assert quote.source == "stooq"


def test_stooq_returns_none_on_nd_row(mocker):
    csv = "Symbol,Date,Time,Open,High,Low,Close,Volume\nPETR4.SA,N/D,N/D,N/D,N/D,N/D,N/D,N/D\n"
    mocker.patch("core.data_sources.quotes.requests.get", return_value=_resp(text=csv))
    assert StooqProvider().fetch("PETR4", "BR") is None


def test_stooq_returns_none_on_http_error(mocker):
    mocker.patch("core.data_sources.quotes.requests.get", return_value=_resp(status=500))
    assert StooqProvider().fetch("AAPL", "US") is None


# ---------- Chain ----------

def _quote(source: str):
    return type(
        "Q", (), {
            "price": 1.0, "currency": "USD",
            "as_of": datetime(2026, 5, 9, tzinfo=timezone.utc),
            "source": source,
        },
    )()


def test_chain_returns_primary_when_primary_succeeds(mocker):
    mocker.patch.object(BrapiProvider, "fetch", return_value=_quote("brapi"))
    yahoo_spy = mocker.patch.object(YahooProvider, "fetch")
    quote = get_quote_from_chain("PETR4", "BR")
    assert quote is not None and quote.source == "brapi"
    yahoo_spy.assert_not_called()


def test_chain_falls_back_when_primary_fails(mocker):
    mocker.patch.object(BrapiProvider, "fetch", return_value=None)
    mocker.patch.object(YahooProvider, "fetch", return_value=_quote("yahoo"))
    quote = get_quote_from_chain("PETR4", "BR")
    assert quote is not None and quote.source == "yahoo"


def test_chain_returns_none_when_all_providers_fail(mocker):
    mocker.patch.object(BrapiProvider, "fetch", return_value=None)
    mocker.patch.object(YahooProvider, "fetch", return_value=None)
    assert get_quote_from_chain("PETR4", "BR") is None


def test_chain_us_uses_yahoo_then_stooq(mocker):
    yahoo_spy = mocker.patch.object(YahooProvider, "fetch", return_value=None)
    stooq_spy = mocker.patch.object(StooqProvider, "fetch", return_value=_quote("stooq"))
    quote = get_quote_from_chain("AAPL", "US")
    assert quote is not None and quote.source == "stooq"
    yahoo_spy.assert_called_once()
    stooq_spy.assert_called_once()
