import React, { Component } from 'react';
import { PageHeader, Button, Glyphicon } from 'react-bootstrap';
import CopyToClipboard from 'react-copy-to-clipboard';
import './App.css';

import AddIndexer from "./AddIndexer";
import IndexerList from "./IndexerList";
import ConfigModal from "./ConfigModal";
import SearchModal from "./SearchModal";
import AlertDismissable from "./AlertDismissable";
import Login from './Login';
import Logo from './cardigann.gif';
import xhrUrl from './xhr';

class App extends Component {
  static defaultProps = {
    indexers: [],
    enabledIndexers: [],
    apiKey: localStorage.getItem('apiKey'),
  }
  state = {
    indexers: this.props.indexers,
    enabledIndexers: this.props.enabledIndexers,
    configure: null,
    search: null,
    authChecked: false,
    apiKey: this.props.apiKey,
    apiKeyCopied: false,
    errorMessage: false,
    version: "unknown",
  }
  isEnabled = (indexer) => {
    return this.state.enabledIndexers.filter((x) => x === indexer.id).length > 0;
  }
  handleSaveIndexer = (indexer, config, afterFunc) => {
    fetch(xhrUrl("/xhr/indexers/"+indexer.id+"/config"), {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': 'apitoken ' + this.state.apiKey,
        },
        method: "PATCH",
        body: JSON.stringify(config),
    })
    .then((res) => {
      if (!res.ok) {
        return res.json().then((resp) => {
          throw Error(resp.error);
        });
      }
      afterFunc();
    })
    .catch((err) => {
      console.warn(err);
      this.setState({errorMessage: err.toString()})
    });
  }
  handleAddIndexer = (selected) => {
    this.loadIndexerConfig(selected, (config) => {
      this.showConfigModal(selected, config);
    });
  }
  handleEditIndexer = (selected, afterFunc) => {
    this.loadIndexerConfig(selected, (config) => {
      this.showConfigModal(selected, config, afterFunc);
    });
  }
  handleDisableIndexer = (selected, afterFunc) => {
    this.handleSaveIndexer(selected, {"enabled": "false"}, () => {
      afterFunc();
      this.setState({
        enabledIndexers: this.state.enabledIndexers.filter((x) => x !== selected.id)
      });
    });
  }
  handleTestIndexer = (indexer, afterFunc) => {
    fetch(xhrUrl("/xhr/indexers/"+indexer.id+"/test"), {
        headers: {
          'Accept': 'application/json',
          'Authorization': 'apitoken ' + this.state.apiKey,
        },
        method: "GET"
    })
    .then((response) => response.json())
    .then((data) => {
      if(data.ok) {
        afterFunc(true);
      } else {
        afterFunc(false, data.error);
        throw Error(data.error);
      }
    })
    .catch((err) => {
      console.warn(err);
      this.setState({errorMessage: err.message}, () => afterFunc(false, err.message))
    });
  }
  handleSearchIndexer = (indexer, afterFunc) => {
    this.showSearchModal(indexer, afterFunc);
  }
  handleAuthenticate = (apiKey) => {
    apiKey = (apiKey === "") ? null : apiKey;
    localStorage.setItem("apiKey", apiKey);
    this.setState({apiKey: apiKey}, this.loadIndexers);
  }
  loadIndexerConfig = (indexer, dataFunc) => {
    fetch(xhrUrl("/xhr/indexers/"+indexer.id+"/config"), {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': 'apitoken ' + this.state.apiKey,
        },
    })
    .then((response) => response.json())
    .then(dataFunc)
    .catch((err) => {
      console.warn(err);
      this.setState({errorMessage: err.message})
    });
  }
  checkAuth = () => {
    fetch(xhrUrl("/xhr/auth"), {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': 'apitoken ' + this.state.apiKey,
      }
    })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((resp) => {
          throw Error(resp.error);
        });
      }
      return response.json()
    })
    .then((data) => {
      this.setState({authChecked: true}, () => {
        this.handleAuthenticate(data.token);
      });
    })
    .catch((err) => {
      console.error(err);
    });
  }
  loadIndexers = () => {
    if (!this.state.apiKey) {
      console.error("No api key is set");
      return;
    }
    fetch(xhrUrl("/xhr/indexers"), {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': 'apitoken ' + this.state.apiKey,
        },
    })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((resp) => {
          throw Error(resp.error);
        });
      }
      return response.json()
    })
    .then((indexers) => {
      this.setState({
        indexers: indexers,
        enabledIndexers: indexers.filter((x) => x.enabled).map((x) => x.id),
      })
    })
    .catch((err) => {
      console.warn(err);
      this.setState({errorMessage: err.message, errorScope: "loading indexers"})
    });
  }
  showConfigModal = (indexer, config, afterFunc) => {
    if (typeof(afterFunc) !== "function") {
      afterFunc = () => {};
    }
    this.setState({
      configure: <ConfigModal config={config} indexer={indexer} show={true}
        onClose={() => {
          this.setState({configure: null});
          afterFunc();
        }}
        onSave={(indexer, config, afterSaveFunc) => {
          if (!this.isEnabled(indexer)) {
            this.setState({
              enabledIndexers: this.state.enabledIndexers.concat([indexer.id]),
              configure: false
            });
          }
          this.handleSaveIndexer(indexer, config, () => { afterFunc(); afterSaveFunc() });
        }}
      />
    });
  }
  showSearchModal = (indexer, afterFunc) => {
    this.setState({
      search: <SearchModal indexer={indexer} show={true} onClose={afterFunc} apiKey={this.state.apiKey} />
    });
  }
  checkVersion = () => {
    fetch(xhrUrl("/xhr/version")).then((response) => {
      response.json().then((json) => {
        this.setState({version: json});
      });
    });
  }
  componentWillMount() {
    if (!this.state.authChecked) {
      this.checkAuth();
    }
    if (this.state.version === "unknown") {
      this.checkVersion();
    }
  }
  render() {
    let isEnabled = this.isEnabled;
    let addableIndexers = this.state.indexers.filter((x) => !isEnabled(x));
    let enabledIndexers = this.state.indexers.filter((x) => isEnabled(x));
    let errorAlert = null;

    if (this.state.authChecked === false) {
      return <div className="App__spinner">Checking authentication...</div>;
    }

    if (this.state.apiKey === null) {
      return <Login onAuthenticate={this.handleAuthenticate} />;
    }

    if (this.state.errorMessage) {
      errorAlert = <AlertDismissable>
        <h4>An error occurred {this.state.errorScope ? "whilst " + this.state.errorScope : ""}</h4>
        <p>{this.state.errorMessage}</p>
      </AlertDismissable>;
    }

    var issueLink = "https://github.com/cardigann/cardigann/issues/new?title=Bug+in+version+" + this.state.version;

    return (
      <div className="App container-fluid">
        <PageHeader><img src={Logo} height="40" width="35" alt="line drawing of cardigan"/> Cardigann <small>Proxy</small></PageHeader>
        {errorAlert}
        <div className="App__apiKey">
          <strong>API Key: </strong>
          <code>{this.state.apiKey}</code>
          <CopyToClipboard text={this.state.apiKey} onCopy={() => this.setState({apiKeyCopied: true})}>
            <Button bsSize="xsmall">Copy <Glyphicon glyph="copy" /></Button>
          </CopyToClipboard>
          {this.state.apiKeyCopied ? <span className="copied">Copied.</span> : null}
        </div>
        <div className="App__body">
          <AddIndexer
            indexers={addableIndexers}
            onAdd={this.handleAddIndexer} />
          <IndexerList
            indexers={enabledIndexers}
            onEdit={this.handleEditIndexer}
            onSave={this.handleSaveIndexer}
            onTest={this.handleTestIndexer}
            onDisable={this.handleDisableIndexer}
            onSearch={this.handleSearchIndexer} />
          {this.state.configure}
          {this.state.search}
        </div>
        <footer className="footer">
          <p className="text-muted">
            <a href={issueLink}>Report a bug</a> in <code>{this.state.version}</code>.
          </p>
        </footer>
      </div>
    );
  }
}

export default App;
