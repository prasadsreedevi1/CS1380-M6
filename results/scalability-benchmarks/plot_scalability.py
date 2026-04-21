import pandas as pd
import matplotlib.pyplot as plt

# Load your CSV
df = pd.read_csv('scalability-benchmark.csv')

# Set your actual repo count here:
repo_count = 100  # Change if your seed file has a different number

df['throughput'] = repo_count / (df['elapsed_ms'] / 1000)

# Plot Latency
plt.figure(figsize=(6,4))
plt.plot(df['nodes'], df['elapsed_ms']/1000, marker='o')
plt.xlabel('Number of Nodes')
plt.ylabel('Elapsed Time (s)')
plt.title('Latency vs. Number of Nodes')
plt.grid(True)
plt.tight_layout()
plt.savefig('latency_vs_nodes.png')
plt.show()

# Plot Throughput
plt.figure(figsize=(6,4))
plt.plot(df['nodes'], df['throughput'], marker='o', color='orange')
plt.xlabel('Number of Nodes')
plt.ylabel('Throughput (repos/sec)')
plt.title('Throughput vs. Number of Nodes')
plt.grid(True)
plt.tight_layout()
plt.savefig('throughput_vs_nodes.png')
plt.show()
