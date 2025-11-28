import universityLogo from '/images/university-logo.svg';

export default function TestLucide() {
  return (
    <div className="university-logo-container" style={{ textAlign: 'center', margin: '0 0 20px 0' }}>
      <img 
        src={universityLogo} 
        alt="Logo de l'université" 
        style={{ 
          width: '180px', 
          height: 'auto',
          maxWidth: '100%'
        }} 
      />
    </div>
  );
}
