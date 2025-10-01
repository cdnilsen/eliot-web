// CardRelationshipGraph.ts - Vanilla TypeScript version (no React needed)
import * as d3 from 'd3';

export interface CardNode {
  id: number;
  deck: string;
  frontText: string;
  backText?: string;
  isCenter?: boolean;
}

export interface RelationshipLink {
  source: number;
  target: number;
  type: 'peer' | 'dependent' | 'prereq';
}

export function createCardRelationshipGraph(
  centerCard: CardNode,
  relatedCards: CardNode[],
  relationships: RelationshipLink[],
  onCardClick?: (cardId: number) => void,
  onClose?: () => void
): HTMLElement {

  // Create modal backdrop
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;

  // Create modal content
  const content = document.createElement('div');
  content.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 20px;
    max-width: 90%;
    max-height: 90%;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    border-bottom: 1px solid #dee2e6;
    padding-bottom: 15px;
  `;

  const title = document.createElement('h3');
  title.textContent = `Card Relationships - Card ${centerCard.id}`;
  title.style.cssText = `margin: 0; color: #333;`;

  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '×';
  closeBtn.style.cssText = `
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #666;
  `;
  closeBtn.onclick = () => {
    document.body.removeChild(modal);
    if (onClose) onClose();
  };

  header.appendChild(title);
  header.appendChild(closeBtn);

  // Legend
  const legend = document.createElement('div');
  legend.style.cssText = `
    display: flex;
    gap: 20px;
    margin-bottom: 15px;
    font-size: 12px;
    justify-content: center;
  `;
  legend.innerHTML = `
    <div style="display: flex; align-items: center; gap: 5px;">
      <div style="width: 20px; height: 2px; background-color: #28a745;"></div>
      <span>Peer</span>
    </div>
    <div style="display: flex; align-items: center; gap: 5px;">
      <div style="width: 20px; height: 2px; background-color: #dc3545;"></div>
      <span>→ Dependent</span>
    </div>
    <div style="display: flex; align-items: center; gap: 5px;">
      <div style="width: 20px; height: 2px; background-color: #ffc107;"></div>
      <span>→ Prerequisite</span>
    </div>
  `;

  // Create SVG
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '600');
  svg.setAttribute('height', '400');
  svg.style.cssText = `
    border: 1px solid #dee2e6;
    border-radius: 4px;
    background-color: #f8f9fa;
  `;

  // Instructions
  const instructions = document.createElement('div');
  instructions.style.cssText = `
    margin-top: 15px;
    text-align: center;
    font-size: 12px;
    color: #666;
  `;
  instructions.innerHTML = '<p>Click and drag nodes to rearrange • Click nodes to view details</p>';

  // Assemble content
  content.appendChild(header);
  content.appendChild(legend);
  content.appendChild(svg);
  content.appendChild(instructions);
  modal.appendChild(content);

  // Initialize D3 graph
  initializeD3Graph(svg, centerCard, relatedCards, relationships, onCardClick);

  // Close on backdrop click
  modal.onclick = (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
      if (onClose) onClose();
    }
  };

  return modal;
}

function initializeD3Graph(
  svgElement: SVGElement,
  centerCard: CardNode,
  relatedCards: CardNode[],
  relationships: RelationshipLink[],
  onCardClick?: (cardId: number) => void
) {
  const svg = d3.select(svgElement);
  const width = 600;
  const height = 400;

  // Prepare data
  const allCards = [{ ...centerCard, isCenter: true }, ...relatedCards];
  const nodes = allCards.map(card => ({
    ...card,
    x: width / 2 + (Math.random() - 0.5) * 100,
    y: height / 2 + (Math.random() - 0.5) * 100
  }));

  const links = relationships.map(rel => ({
    source: rel.source,
    target: rel.target,
    type: rel.type
  }));

  // Create force simulation
  const simulation = d3.forceSimulation(nodes as any)
    .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(30));

  // Color scheme
  const linkColors = {
    peer: "#28a745",
    dependent: "#dc3545", 
    prereq: "#ffc107"
  };

  // Create arrow markers
  svg.append("defs").selectAll("marker")
    .data(["dependent", "prereq"])
    .join("marker")
    .attr("id", d => `arrow-${d}`)
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 25)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", d => linkColors[d as keyof typeof linkColors]);

  // Create links
  const link = svg.append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("stroke", d => linkColors[d.type])
    .attr("stroke-width", 2)
    .attr("marker-end", d => d.type !== 'peer' ? `url(#arrow-${d.type})` : null);

  // Create nodes
  const node = svg.append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .style("cursor", "pointer")
    .call(d3.drag<any, any>()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended));

  // Add circles
  node.append("circle")
    .attr("r", d => d.isCenter ? 25 : 20)
    .attr("fill", d => d.isCenter ? "#007bff" : "#6c757d")
    .attr("stroke", "#fff")
    .attr("stroke-width", 2);

  // Add labels
  node.append("text")
    .text(d => `Card ${d.id}`)
    .attr("text-anchor", "middle")
    .attr("dy", "0.3em")
    .attr("fill", "white")
    .attr("font-size", d => d.isCenter ? "12px" : "10px")
    .attr("font-weight", d => d.isCenter ? "bold" : "normal");

  // Add tooltips
  node.append("title")
    .text(d => {
      const preview = d.frontText.substring(0, 50);
      return `Card ${d.id}\nDeck: ${d.deck}\n${preview}${d.frontText.length > 50 ? '...' : ''}`;
    });

  // Handle clicks
  node.on("click", function(event, d) {
    event.stopPropagation();
    if (onCardClick) {
      onCardClick(d.id);
    }
  });

  // Update positions on tick
  simulation.on("tick", () => {
    link
      .attr("x1", (d: any) => d.source.x)
      .attr("y1", (d: any) => d.source.y)
      .attr("x2", (d: any) => d.target.x)
      .attr("y2", (d: any) => d.target.y);

    node.attr("transform", d => `translate(${d.x},${d.y})`);
  });

  // Drag functions
  function dragstarted(event: any, d: any) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event: any, d: any) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event: any, d: any) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
}
