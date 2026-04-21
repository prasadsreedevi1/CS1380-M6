import pandas as pd
import matplotlib.pyplot as plt

# Load the CSV, skipping empty rows and handling possible missing values
df = pd.read_csv('results/indexing-benchmarks/indexing-latency-throughput.csv')
df = df.dropna(subset=['latency_ms'])  # Remove rows with missing latency

# Convert latency to numeric (in case of stray strings)
df['latency_ms'] = pd.to_numeric(df['latency_ms'], errors='coerce')
df = df.dropna(subset=['latency_ms'])

# Histogram
plt.figure(figsize=(10, 6))
plt.hist(df['latency_ms'], bins=30, color='skyblue', edgecolor='black')
plt.title('Indexing Latency Distribution')
plt.xlabel('Latency (ms)')
plt.ylabel('Number of Repos')
plt.grid(True)
plt.tight_layout()
plt.savefig('results/indexing-benchmarks/latency_histogram.png')
plt.show()

# Boxplot
plt.figure(figsize=(6, 6))
plt.boxplot(df['latency_ms'], vert=True, patch_artist=True)
plt.title('Indexing Latency Boxplot')
plt.ylabel('Latency (ms)')
plt.grid(True)
plt.tight_layout()
plt.savefig('results/indexing-benchmarks/latency_boxplot.png')
plt.show()
