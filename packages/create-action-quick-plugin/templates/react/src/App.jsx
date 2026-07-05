import { useState, useEffect } from 'react';

function App() {
  const [params, setParams] = useState({ query: null, contextText: null });
  const [result, setResult] = useState('');

  useEffect(() => {
    function handleMessage(e) {
      const d = e.data;
      if (d && d.type === 'plugin-params') {
        setParams({ query: d.params.query, contextText: d.params.contextText });
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  async function handleClipboard() {
    try {
      await window.aq.clipboard.write('Hello from React plugin!');
      setResult('✓ 已写入剪贴板');
    } catch (e) {
      setResult('✗ ' + e);
    }
  }

  async function handleNotification() {
    try {
      await window.aq.notification.show({ title: 'React Plugin', body: '来自插件通知' });
      setResult('✓ 通知已发送');
    } catch (e) {
      setResult('✗ ' + e);
    }
  }

  return (
    <div className="app">
      <h1>PLUGIN_NAME</h1>
      <div className="card">
        <strong>插件参数</strong>
        <p>query: {params.query || '(无)'}</p>
        <p>contextText: {params.contextText || '(无)'}</p>
      </div>
      <div className="card">
        <strong>操作</strong>
        <div className="actions">
          <button onClick={handleClipboard}>写入剪贴板</button>
          <button onClick={handleNotification}>发送通知</button>
        </div>
      </div>
      {result && <div className="result">{result}</div>}
    </div>
  );
}

export default App;
