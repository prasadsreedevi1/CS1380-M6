import pandas as pd
import matplotlib.pyplot as plt

df = pd.read_csv('query-latency-throughput.csv')

# Boxplot: Latency distribution per query
plt.figure(figsize=(6,4))
df.boxplot(column='latency_ms', by='query')
plt.title('Query Latency Distribution')
plt.suptitle('')
plt.xlabel('Query')
plt.ylabel('Latency (ms)')
plt.tight_layout()
plt.savefig('query_latency_boxplot.png')
plt.show()

# Bar plot: Average latency per query
plt.figure(figsize=(6,4))
df.groupby('query')['latency_ms'].mean().plot(kind='bar', color='skyblue')
plt.title('Average Query Latency')
plt.xlabel('Query')
plt.ylabel('Average Latency (ms)')
plt.tight_layout()
plt.savefig('query_latency_barplot.png')
plt.show()
