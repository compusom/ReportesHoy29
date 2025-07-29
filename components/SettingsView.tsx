
import React, { useState } from 'react';

interface SettingsViewProps {
    initialConfig: any;
    onTestConnection: (config: any) => Promise<boolean>;
    dbStatus: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ initialConfig, onTestConnection, dbStatus }) => {
    const [config, setConfig] = useState(initialConfig);
    const [testing, setTesting] = useState(false);
    const [lastTestResult, setLastTestResult] = useState<boolean | null>(dbStatus);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleTest = async () => {
        setTesting(true);
        const result = await onTestConnection(config);
        setLastTestResult(result);
        setTesting(false);
    };

    return (
        <div className="max-w-2xl mx-auto bg-brand-surface rounded-lg p-8 shadow-lg animate-fade-in">
            <h2 className="text-2xl font-bold text-brand-text mb-6">Configuración de Base de Datos</h2>
            <p className="text-brand-text-secondary mb-6">
                Introduce los datos de tu base de datos PostgreSQL. La aplicación persistirá los datos de clientes y análisis.
                <br/>
                <strong>Nota:</strong> Esta conexión simula un entorno de backend seguro. La interacción con la "base de datos" tendrá latencia artificial para una experiencia más realista.
            </p>
            <div className="space-y-4">
                <InputField label="Host" name="host" value={config.host} onChange={handleChange} />
                <InputField label="Port" name="port" value={config.port} onChange={handleChange} type="number" />
                <InputField label="User" name="user" value={config.user} onChange={handleChange} />
                <InputField label="Password" name="pass" value={config.pass} onChange={handleChange} type="password" />
                <InputField label="Database" name="database" value={config.database} onChange={handleChange} />
            </div>
            <div className="mt-8 flex items-center justify-between">
                <button
                    onClick={handleTest}
                    disabled={testing}
                    className="bg-brand-primary hover:bg-brand-primary-hover text-white font-bold py-2 px-6 rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {testing ? 'Probando...' : 'Probar y Guardar Conexión'}
                </button>
                {lastTestResult !== null && (
                    <div className={`text-sm font-semibold px-4 py-2 rounded-md ${lastTestResult ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {lastTestResult ? 'Conexión Exitosa' : 'Falló la Conexión'}
                    </div>
                )}
            </div>
        </div>
    );
};

const InputField: React.FC<{ label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; type?: string }> = ({ label, name, value, onChange, type = 'text' }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-brand-text-secondary mb-1">{label}</label>
        <input
            type={type}
            name={name}
            id={name}
            value={value}
            onChange={onChange}
            className="w-full bg-brand-bg border border-brand-border text-brand-text rounded-md p-2 focus:ring-brand-primary focus:border-brand-primary transition-colors"
            autoComplete={type === 'password' ? 'current-password' : 'off'}
        />
    </div>
);
